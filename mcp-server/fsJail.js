'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function normalizeRelPath(input) {
  let p = String(input ?? '').replace(/\\/g, '/').trim();
  if (!p || p === '.') p = '';
  p = p.replace(/^\/+/, '');
  if (p.includes('\0')) {
    const err = new Error('invalid_path');
    err.code = 'invalid_path';
    throw err;
  }
  const parts = p.split('/').filter((seg) => seg && seg !== '.');
  if (parts.some((seg) => seg === '..')) {
    const err = new Error('path_escape');
    err.code = 'path_escape';
    throw err;
  }
  return parts.join('/');
}

function resolveInsideRoot(publicRoot, relInput) {
  const root = path.resolve(publicRoot);
  const rel = normalizeRelPath(relInput);
  const abs = path.resolve(root, rel);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    const err = new Error('path_escape');
    err.code = 'path_escape';
    throw err;
  }
  return { root, rel, abs };
}

async function ensureParentDir(absPath) {
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
}

async function listDir(publicRoot, relInput = '') {
  const { rel, abs } = resolveInsideRoot(publicRoot, relInput);
  const entries = await fsp.readdir(abs, { withFileTypes: true });
  const items = [];
  for (const ent of entries) {
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    items.push({
      name: ent.name,
      path: childRel,
      isDir: ent.isDirectory(),
      isFile: ent.isFile(),
    });
  }
  items.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  return { path: rel || '.', items };
}

async function readTextFile(publicRoot, relInput, maxBytes) {
  const { rel, abs } = resolveInsideRoot(publicRoot, relInput);
  const st = await fsp.stat(abs);
  if (!st.isFile()) {
    const err = new Error('not_a_file');
    err.code = 'not_a_file';
    throw err;
  }
  if (st.size > maxBytes) {
    const err = new Error(`file_too_large:${st.size}`);
    err.code = 'file_too_large';
    throw err;
  }
  const content = await fsp.readFile(abs, 'utf8');
  return { path: rel, size: st.size, content };
}

function assertStorageRoom(publicRoot, addBytes, maxStorageMb, replaceAbs = null) {
  const limitMb = Number(maxStorageMb) || 0;
  if (limitMb <= 0) return;
  const limitBytes = limitMb * 1024 * 1024;
  const usage = diskUsage(publicRoot);
  let used = usage.usedBytes;
  if (replaceAbs) {
    try {
      if (fs.existsSync(replaceAbs) && fs.statSync(replaceAbs).isFile()) {
        used -= fs.statSync(replaceAbs).size;
      }
    } catch {
      /* ignore */
    }
  }
  if (used + addBytes > limitBytes) {
    const err = new Error(`storage_limit_exceeded:${limitMb}`);
    err.code = 'storage_limit_exceeded';
    err.limitMb = limitMb;
    err.usedBytes = Math.max(0, used);
    throw err;
  }
}

async function writeTextFile(publicRoot, relInput, content, maxBytes, maxStorageMb = 0) {
  const { rel, abs } = resolveInsideRoot(publicRoot, relInput);
  if (!rel) {
    const err = new Error('invalid_path');
    err.code = 'invalid_path';
    throw err;
  }
  const buf = Buffer.from(String(content ?? ''), 'utf8');
  if (buf.length > maxBytes) {
    const err = new Error(`payload_too_large:${buf.length}`);
    err.code = 'payload_too_large';
    throw err;
  }
  assertStorageRoom(publicRoot, buf.length, maxStorageMb, abs);
  await ensureParentDir(abs);
  await fsp.writeFile(abs, buf);
  return { path: rel, size: buf.length };
}

async function writeBase64File(publicRoot, relInput, fileBase64, maxBytes, maxStorageMb = 0) {
  const { rel, abs } = resolveInsideRoot(publicRoot, relInput);
  if (!rel) {
    const err = new Error('invalid_path');
    err.code = 'invalid_path';
    throw err;
  }
  const buf = Buffer.from(String(fileBase64 || ''), 'base64');
  if (!buf.length && String(fileBase64 || '').trim()) {
    /* empty decode ok for empty file */
  }
  if (buf.length > maxBytes) {
    const err = new Error(`payload_too_large:${buf.length}`);
    err.code = 'payload_too_large';
    throw err;
  }
  assertStorageRoom(publicRoot, buf.length, maxStorageMb, abs);
  await ensureParentDir(abs);
  await fsp.writeFile(abs, buf);
  return { path: rel, size: buf.length };
}

async function mkdirp(publicRoot, relInput) {
  const { rel, abs } = resolveInsideRoot(publicRoot, relInput);
  if (!rel) {
    const err = new Error('invalid_path');
    err.code = 'invalid_path';
    throw err;
  }
  await fsp.mkdir(abs, { recursive: true });
  return { path: rel };
}

async function movePath(publicRoot, fromInput, toInput) {
  const from = resolveInsideRoot(publicRoot, fromInput);
  const to = resolveInsideRoot(publicRoot, toInput);
  if (!from.rel || !to.rel) {
    const err = new Error('invalid_path');
    err.code = 'invalid_path';
    throw err;
  }
  await ensureParentDir(to.abs);
  await fsp.rename(from.abs, to.abs);
  return { from: from.rel, to: to.rel };
}

async function copyPath(publicRoot, fromInput, toInput) {
  const from = resolveInsideRoot(publicRoot, fromInput);
  const to = resolveInsideRoot(publicRoot, toInput);
  if (!from.rel || !to.rel) {
    const err = new Error('invalid_path');
    err.code = 'invalid_path';
    throw err;
  }
  await ensureParentDir(to.abs);
  await fsp.cp(from.abs, to.abs, { recursive: true, errorOnExist: true, force: false });
  return { from: from.rel, to: to.rel };
}

/**
 * Extract a zip (base64) into publicRoot/destRel. Rejects path escape, absolute
 * entries, and symlinks. Enforces archive size, uncompressed budget, storage quota.
 */
async function importZipBase64(
  publicRoot,
  destRelInput,
  fileBase64,
  {
    maxArchiveBytes,
    maxUncompressedBytes,
    maxStorageMb = 0,
  } = {},
) {
  const AdmZip = require('adm-zip');
  const dest = resolveInsideRoot(publicRoot, destRelInput || '');
  const buf = Buffer.from(String(fileBase64 || ''), 'base64');
  if (!buf.length) {
    const err = new Error('empty_archive');
    err.code = 'empty_archive';
    throw err;
  }
  if (maxArchiveBytes && buf.length > maxArchiveBytes) {
    const err = new Error(`payload_too_large:${buf.length}`);
    err.code = 'payload_too_large';
    throw err;
  }

  let zip;
  try {
    zip = new AdmZip(buf);
  } catch (e) {
    const err = new Error('invalid_zip');
    err.code = 'invalid_zip';
    err.cause = e;
    throw err;
  }

  const entries = zip.getEntries();
  let uncompressed = 0;
  const planned = [];

  for (const entry of entries) {
    const rawName = String(entry.entryName || '').replace(/\\/g, '/');
    if (!rawName || rawName.endsWith('/')) continue;
    if (rawName.startsWith('/') || /^[a-zA-Z]:/.test(rawName)) {
      const err = new Error('zip_path_escape');
      err.code = 'zip_path_escape';
      throw err;
    }
    const parts = rawName.split('/').filter((s) => s && s !== '.');
    if (parts.some((s) => s === '..')) {
      const err = new Error('zip_path_escape');
      err.code = 'zip_path_escape';
      throw err;
    }
    // Skip symlink-looking attrs if present (adm-zip attr bit).
    const attr = entry.attr >>> 0;
    if ((attr & 0o170000) === 0o120000) {
      const err = new Error('zip_symlink_rejected');
      err.code = 'zip_symlink_rejected';
      throw err;
    }
    const relInside = parts.join('/');
    const rel = dest.rel ? `${dest.rel}/${relInside}` : relInside;
    resolveInsideRoot(publicRoot, rel);
    const size = Number(entry.header?.size) || 0;
    uncompressed += size;
    planned.push({ entry, rel, size });
  }

  if (maxUncompressedBytes && uncompressed > maxUncompressedBytes) {
    const err = new Error(`uncompressed_too_large:${uncompressed}`);
    err.code = 'uncompressed_too_large';
    throw err;
  }
  assertStorageRoom(publicRoot, uncompressed, maxStorageMb, null);

  await fsp.mkdir(dest.abs, { recursive: true });
  const written = [];
  for (const item of planned) {
    const { abs } = resolveInsideRoot(publicRoot, item.rel);
    await ensureParentDir(abs);
    const data = item.entry.getData();
    await fsp.writeFile(abs, data);
    try {
      await fsp.chmod(abs, 0o644);
    } catch {
      /* ignore */
    }
    written.push({ path: item.rel, size: data.length });
  }

  // Ensure dirs are traversable by nginx (user nginx).
  try {
    const { execFileSync } = require('node:child_process');
    execFileSync('chmod', ['-R', 'a+rX', dest.abs], { stdio: 'ignore' });
  } catch {
    /* Windows / missing chmod — best-effort */
  }

  return {
    dest: dest.rel || '.',
    archiveBytes: buf.length,
    uncompressedBytes: uncompressed,
    filesWritten: written.length,
    files: written.slice(0, 200),
    truncated: written.length > 200,
  };
}

async function deletePath(publicRoot, relInput) {
  const { rel, abs } = resolveInsideRoot(publicRoot, relInput);
  if (!rel) {
    const err = new Error('refuse_delete_root');
    err.code = 'refuse_delete_root';
    throw err;
  }
  await fsp.rm(abs, { recursive: true, force: false });
  return { path: rel };
}

async function walkTree(publicRoot, relInput, { maxFiles = 500, maxDepth = 6 } = {}) {
  const rootResolved = resolveInsideRoot(publicRoot, relInput || '');
  const out = [];
  const queue = [{ rel: rootResolved.rel, abs: rootResolved.abs, depth: 0 }];

  while (queue.length && out.length < maxFiles) {
    const cur = queue.shift();
    let entries;
    try {
      entries = await fsp.readdir(cur.abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (out.length >= maxFiles) break;
      const childRel = cur.rel ? `${cur.rel}/${ent.name}` : ent.name;
      const childAbs = path.join(cur.abs, ent.name);
      const isDir = ent.isDirectory();
      out.push({ path: childRel, isDir });
      if (isDir && cur.depth + 1 < maxDepth) {
        queue.push({ rel: childRel, abs: childAbs, depth: cur.depth + 1 });
      }
    }
  }
  return {
    root: rootResolved.rel || '.',
    files: out,
    truncated: out.length >= maxFiles,
  };
}

async function searchFiles(publicRoot, query, { maxResults = 100 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    const err = new Error('query required');
    err.code = 'invalid_args';
    throw err;
  }
  const walked = await walkTree(publicRoot, '', { maxFiles: 2000, maxDepth: 12 });
  const results = [];
  for (const item of walked.files) {
    if (item.path.toLowerCase().includes(q)) {
      results.push(item);
      if (results.length >= maxResults) break;
    }
  }
  return { query: q, results, truncated: results.length >= maxResults };
}

function diskUsage(publicRoot) {
  const root = path.resolve(publicRoot);
  let usedBytes = 0;
  let files = 0;
  let dirs = 0;

  function walkSync(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        dirs += 1;
        walkSync(p);
      } else if (ent.isFile()) {
        files += 1;
        try {
          usedBytes += fs.statSync(p).size;
        } catch {
          /* ignore */
        }
      }
    }
  }

  walkSync(root);
  return { publicRoot: root, usedBytes, files, dirs };
}

module.exports = {
  normalizeRelPath,
  resolveInsideRoot,
  listDir,
  readTextFile,
  writeTextFile,
  writeBase64File,
  mkdirp,
  movePath,
  copyPath,
  importZipBase64,
  deletePath,
  walkTree,
  searchFiles,
  diskUsage,
  assertStorageRoom,
};
