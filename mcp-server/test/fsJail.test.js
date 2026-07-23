'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeRelPath, resolveInsideRoot, writeTextFile, readTextFile, deletePath, copyPath, importZipBase64 } = require('../fsJail');
const { parseKeysFromEnv, KEYS_MAX } = require('../mcpConfig');
const { timingSafeEqualString } = require('../auth');
const AdmZip = require('adm-zip');

describe('fsJail', () => {
  it('rejects .. segments', () => {
    assert.throws(() => normalizeRelPath('../etc/passwd'), /path_escape/);
    assert.throws(() => normalizeRelPath('a/../../b'), /path_escape/);
  });

  it('resolves inside root only', () => {
    const root = path.resolve('/tmp/hosting-mcp-public-test');
    const { abs, rel } = resolveInsideRoot(root, 'css/main.css');
    assert.equal(rel, 'css/main.css');
    assert.ok(abs.startsWith(root));
  });

  it('crud text file in temp root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-mcp-'));
    try {
      await writeTextFile(root, 'hello.txt', 'hi', 1024);
      const got = await readTextFile(root, 'hello.txt', 1024);
      assert.equal(got.content, 'hi');
      await deletePath(root, 'hello.txt');
      assert.equal(fs.existsSync(path.join(root, 'hello.txt')), false);
      await assert.rejects(() => deletePath(root, ''), /refuse_delete_root/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('copies file within root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-mcp-cp-'));
    try {
      await writeTextFile(root, 'a.txt', 'copy-me', 1024);
      await copyPath(root, 'a.txt', 'b.txt');
      assert.equal(fs.readFileSync(path.join(root, 'b.txt'), 'utf8'), 'copy-me');
      assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'copy-me');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('imports zip into public root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-mcp-zip-'));
    try {
      const zip = new AdmZip();
      zip.addFile('index.html', Buffer.from('<h1>zip</h1>'));
      zip.addFile('css/a.css', Buffer.from('body{}'));
      const b64 = zip.toBuffer().toString('base64');
      const out = await importZipBase64(root, '', b64, {
        maxArchiveBytes: 1024 * 1024,
        maxUncompressedBytes: 1024 * 1024,
        maxStorageMb: 10,
      });
      assert.equal(out.filesWritten, 2);
      assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), '<h1>zip</h1>');
      assert.equal(fs.readFileSync(path.join(root, 'css', 'a.css'), 'utf8'), 'body{}');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects zip path escape', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-mcp-zipbad-'));
    try {
      const zip = new AdmZip();
      zip.addFile('safe.txt', Buffer.from('nope'));
      zip.getEntries()[0].entryName = '../evil.txt';
      const b64 = zip.toBuffer().toString('base64');
      await assert.rejects(
        () =>
          importZipBase64(root, '', b64, {
            maxArchiveBytes: 1024 * 1024,
            maxUncompressedBytes: 1024 * 1024,
          }),
        /zip_path_escape/,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('enforces max storage quota on write', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-mcp-quota-'));
    try {
      await writeTextFile(root, 'a.txt', 'x'.repeat(100), 10_000, 0.0001);
      await assert.rejects(() => writeTextFile(root, 'b.txt', 'y'.repeat(200), 10_000, 0.0001), /storage_limit_exceeded/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('env keys', () => {
  it('parses comma list and caps at KEYS_MAX', () => {
    const prev = process.env.HOSTINGMCP_MCP_KEYS;
    const indexed = [];
    for (let i = 1; i <= 5; i += 1) indexed.push(process.env[`HOSTINGMCP_MCP_KEY_${i}`]);
    try {
      process.env.HOSTINGMCP_MCP_KEYS = 'a,b,c,d,e,f,g';
      for (let i = 1; i <= 5; i += 1) delete process.env[`HOSTINGMCP_MCP_KEY_${i}`];
      const keys = parseKeysFromEnv();
      assert.equal(keys.length, KEYS_MAX);
      assert.deepEqual(keys, ['a', 'b', 'c', 'd', 'e']);
    } finally {
      if (prev === undefined) delete process.env.HOSTINGMCP_MCP_KEYS;
      else process.env.HOSTINGMCP_MCP_KEYS = prev;
      for (let i = 1; i <= 5; i += 1) {
        if (indexed[i - 1] === undefined) delete process.env[`HOSTINGMCP_MCP_KEY_${i}`];
        else process.env[`HOSTINGMCP_MCP_KEY_${i}`] = indexed[i - 1];
      }
    }
  });
});

describe('upload limits', () => {
  it('derives write/json/import from HOSTINGMCP_MCP_MAX_UPLOAD_MB', () => {
    const prev = process.env.HOSTINGMCP_MCP_MAX_UPLOAD_MB;
    try {
      process.env.HOSTINGMCP_MCP_MAX_UPLOAD_MB = '30';
      const { resolveUploadLimits } = require('../mcpConfig');
      const lim = resolveUploadLimits();
      assert.equal(lim.uploadMb, 30);
      assert.equal(lim.writeMaxBytes, 30 * 1024 * 1024);
      assert.equal(lim.jsonBodyLimit, '48mb');
      assert.equal(lim.importMaxUncompressedBytes, 120 * 1024 * 1024);
    } finally {
      if (prev === undefined) delete process.env.HOSTINGMCP_MCP_MAX_UPLOAD_MB;
      else process.env.HOSTINGMCP_MCP_MAX_UPLOAD_MB = prev;
    }
  });
});

describe('auth helper', () => {
  it('timingSafeEqualString matches equal secrets', () => {
    assert.equal(timingSafeEqualString('abc', 'abc'), true);
    assert.equal(timingSafeEqualString('abc', 'abd'), false);
    assert.equal(timingSafeEqualString('abc', 'ab'), false);
  });
});
