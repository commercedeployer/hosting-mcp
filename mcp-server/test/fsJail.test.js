'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeRelPath, resolveInsideRoot, writeTextFile, readTextFile, deletePath } = require('../fsJail');
const { parseKeysFromEnv, KEYS_MAX } = require('../mcpConfig');
const { timingSafeEqualString } = require('../auth');

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

describe('auth helper', () => {
  it('timingSafeEqualString matches equal secrets', () => {
    assert.equal(timingSafeEqualString('abc', 'abc'), true);
    assert.equal(timingSafeEqualString('abc', 'abd'), false);
    assert.equal(timingSafeEqualString('abc', 'ab'), false);
  });
});
