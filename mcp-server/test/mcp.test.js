'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const { createMcpServer } = require('../server');

describe('MCP HTTP', () => {
  let app;
  let root;
  const key = 'mch_mcp_live_test_key_0001';

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hosting-mcp-'));
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>seed</h1>');
    const config = {
      keys: [key],
      keysMax: 5,
      publicRoot: root,
      publicBaseUrl: 'http://localhost:8088',
      listen: '127.0.0.1:0',
      toolsDeny: new Set(),
      version: '0.1.0-test',
      rateLimit: { windowMs: 60_000, maxPerWindow: 1000 },
      concurrency: { maxConcurrent: 4, maxQueued: 16, queueTimeoutMs: 60_000 },
      readMaxBytes: 2 * 1024 * 1024,
      writeMaxBytes: 25 * 1024 * 1024,
      jsonBodyLimit: '40mb',
      importMaxUncompressedBytes: 100 * 1024 * 1024,
      maxUploadMb: 25,
      maxStorageMb: 1024,
    };
    app = express();
    app.use('/mcp', createMcpServer(config));
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function mcpSession() {
    const init = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${key}`)
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal(init.status, 200);
    const sessionId = init.headers['mcp-session-id'];
    assert.ok(sessionId);
    return sessionId;
  }

  it('rejects missing bearer', async () => {
    const res = await request(app).post('/mcp').send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal(res.status, 401);
  });

  it('initialize + tools/list + write index', async () => {
    const sessionId = await mcpSession();
    const list = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${key}`)
      .set('Mcp-Session-Id', sessionId)
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    assert.equal(list.status, 200);
    const tools = list.body.result.tools.map((t) => t.name);
    assert.ok(tools.includes('hostingmcp_files_write'));

    const call = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${key}`)
      .set('Mcp-Session-Id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'hostingmcp_files_write',
          arguments: { path: 'index.html', content: '<h1>live</h1>' },
        },
      });
    assert.equal(call.status, 200);
    assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), '<h1>live</h1>');
  });
});
