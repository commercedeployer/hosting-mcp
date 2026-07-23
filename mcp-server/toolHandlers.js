'use strict';

const fs = require('node:fs');
const http = require('node:http');
const { mcpConfig } = require('./mcpConfig');
const jail = require('./fsJail');

function ok(data) {
  return { ok: true, ...data };
}

function cfgOf(ctx) {
  return ctx?.config || mcpConfig();
}

async function hostingmcp_capabilities(ctx) {
  const cfg = cfgOf(ctx);
  return ok({
    product: 'hosting-mcp',
    version: cfg.version,
    access: 'full',
    keysConfigured: cfg.keys.length,
    keysMax: cfg.keysMax,
    publicRoot: cfg.publicRoot,
    publicBaseUrl: cfg.publicBaseUrl || null,
    mcpUrl: cfg.publicBaseUrl ? `${cfg.publicBaseUrl}/mcp` : null,
    filesUrl: cfg.publicBaseUrl ? `${cfg.publicBaseUrl}/files/` : '/files/',
    maxStorageMb: cfg.maxStorageMb || null,
    writeMaxBytes: cfg.writeMaxBytes,
    readMaxBytes: cfg.readMaxBytes,
    jsonBodyLimit: cfg.jsonBodyLimit,
    importMaxUncompressedBytes: cfg.importMaxUncompressedBytes,
    maxUploadMb: cfg.maxUploadMb,
    hint:
      'Tune HOSTINGMCP_MCP_MAX_UPLOAD_MB / HOSTINGMCP_MAX_STORAGE_MB. Dump site: files_import_zip. Large media → /files/.',
  });
}

async function hostingmcp_health(ctx) {
  const cfg = cfgOf(ctx);
  let publicOk = false;
  try {
    publicOk = fs.existsSync(cfg.publicRoot) && fs.statSync(cfg.publicRoot).isDirectory();
  } catch {
    publicOk = false;
  }
  return ok({
    status: publicOk ? 'ok' : 'degraded',
    publicRoot: cfg.publicRoot,
    publicWritable: publicOk,
    keysConfigured: cfg.keys.length > 0,
  });
}

async function hostingmcp_storage_usage(ctx) {
  const cfg = cfgOf(ctx);
  const usage = jail.diskUsage(cfg.publicRoot);
  const maxStorageMb = cfg.maxStorageMb || 0;
  return ok({
    ...usage,
    maxStorageMb: maxStorageMb || null,
    maxStorageBytes: maxStorageMb > 0 ? maxStorageMb * 1024 * 1024 : null,
  });
}

async function hostingmcp_site_smoke(ctx) {
  const cfg = cfgOf(ctx);
  const indexAbs = require('node:path').join(cfg.publicRoot, 'index.html');
  const indexPresent = fs.existsSync(indexAbs) && fs.statSync(indexAbs).isFile();
  let httpStatus = null;
  let httpError = null;
  try {
    httpStatus = await new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: 80, path: '/', method: 'HEAD', timeout: 3000 },
        (res) => {
          res.resume();
          resolve(res.statusCode || 0);
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
      req.on('error', reject);
      req.end();
    });
  } catch (e) {
    httpError = e?.message || String(e);
  }
  const okHttp = httpStatus === 200 || httpStatus === 301 || httpStatus === 302;
  return ok({
    indexPresent,
    httpStatus,
    httpError,
    publicBaseUrl: cfg.publicBaseUrl || null,
    status: indexPresent && (httpStatus == null || okHttp) ? 'ok' : 'degraded',
  });
}

async function hostingmcp_files_list(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.listDir(cfg.publicRoot, args?.path || ''));
}

async function hostingmcp_files_read(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.readTextFile(cfg.publicRoot, args?.path, cfg.readMaxBytes));
}

async function hostingmcp_files_write(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(
    await jail.writeTextFile(cfg.publicRoot, args?.path, args?.content, cfg.writeMaxBytes, cfg.maxStorageMb),
  );
}

async function hostingmcp_files_write_base64(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(
    await jail.writeBase64File(
      cfg.publicRoot,
      args?.path,
      args?.fileBase64,
      cfg.writeMaxBytes,
      cfg.maxStorageMb,
    ),
  );
}

async function hostingmcp_files_mkdir(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.mkdirp(cfg.publicRoot, args?.path));
}

async function hostingmcp_files_move(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.movePath(cfg.publicRoot, args?.from, args?.to));
}

async function hostingmcp_files_copy(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.copyPath(cfg.publicRoot, args?.from, args?.to));
}

async function hostingmcp_files_import_zip(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(
    await jail.importZipBase64(cfg.publicRoot, args?.destPath || '', args?.fileBase64, {
      maxArchiveBytes: cfg.writeMaxBytes,
      maxUncompressedBytes: cfg.importMaxUncompressedBytes,
      maxStorageMb: cfg.maxStorageMb,
    }),
  );
}

async function hostingmcp_files_delete(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.deletePath(cfg.publicRoot, args?.path));
}

async function hostingmcp_files_tree(ctx, args) {
  const cfg = cfgOf(ctx);
  const maxFiles = Math.min(Number(args?.maxFiles) || 500, 2000);
  const maxDepth = Math.min(Number(args?.maxDepth) || 6, 12);
  return ok(await jail.walkTree(cfg.publicRoot, args?.path || '', { maxFiles, maxDepth }));
}

async function hostingmcp_files_search(ctx, args) {
  const cfg = cfgOf(ctx);
  const maxResults = Math.min(Number(args?.maxResults) || 100, 500);
  return ok(await jail.searchFiles(cfg.publicRoot, args?.query || args?.q, { maxResults }));
}

function createHandlers() {
  return {
    hostingmcp_capabilities,
    hostingmcp_health,
    hostingmcp_storage_usage,
    hostingmcp_site_smoke,
    hostingmcp_files_list,
    hostingmcp_files_read,
    hostingmcp_files_write,
    hostingmcp_files_write_base64,
    hostingmcp_files_mkdir,
    hostingmcp_files_move,
    hostingmcp_files_copy,
    hostingmcp_files_import_zip,
    hostingmcp_files_delete,
    hostingmcp_files_tree,
    hostingmcp_files_search,
  };
}

module.exports = { createHandlers };
