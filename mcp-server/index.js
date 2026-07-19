'use strict';

const express = require('express');
const { mcpConfig } = require('./mcpConfig');
const { createMcpServer } = require('./server');

function parseListen(listen) {
  const s = String(listen || '127.0.0.1:3101');
  if (s.startsWith('/')) return { path: s };
  const [host, portRaw] = s.includes(':') ? s.split(':') : ['127.0.0.1', s];
  return { host, port: parseInt(portRaw, 10) || 3101 };
}

function main() {
  const config = mcpConfig();
  const app = express();
  const mcp = createMcpServer(config);

  app.get('/healthz', (_req, res) => {
    res.json({
      ok: true,
      product: 'mcp-hosting',
      version: config.version,
      keysConfigured: config.keys.length,
    });
  });

  app.use('/mcp', mcp);

  const addr = parseListen(config.listen);
  const server = addr.path
    ? app.listen(addr.path, onListen)
    : app.listen(addr.port, addr.host, onListen);

  function onListen() {
    console.log(
      `[mcp-hosting] listening ${config.listen} publicRoot=${config.publicRoot} keys=${config.keys.length}`,
    );
  }

  return server;
}

if (require.main === module) {
  main();
}

module.exports = { main };
