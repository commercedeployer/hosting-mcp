'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { parseMcpToolsDeny } = require('./toolPolicy');

const KEYS_MAX = 5;

function parseKeysFromEnv() {
  const fromList = String(process.env.HOSTINGMCP_MCP_KEYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const fromIndexed = [];
  for (let i = 1; i <= KEYS_MAX; i += 1) {
    const v = String(process.env[`HOSTINGMCP_MCP_KEY_${i}`] || '').trim();
    if (v) fromIndexed.push(v);
  }

  const merged = [...fromList, ...fromIndexed];
  const seen = new Set();
  const unique = [];
  for (const k of merged) {
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(k);
  }
  return unique.slice(0, KEYS_MAX);
}

function resolvePublicRoot() {
  const raw = process.env.HOSTINGMCP_PUBLIC_ROOT || process.env.PUBLIC_ROOT || '/var/www/public';
  return path.resolve(raw);
}

function readVersion() {
  const candidates = [
    path.join(__dirname, '..', 'VERSION'),
    '/opt/hosting-mcp/VERSION',
  ];
  for (const f of candidates) {
    try {
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim() || '0.0.0';
    } catch {
      /* ignore */
    }
  }
  return require('./package.json').version || '0.0.0';
}

function mcpConfig() {
  const keys = parseKeysFromEnv();
  return {
    keys,
    keysMax: KEYS_MAX,
    publicRoot: resolvePublicRoot(),
    publicBaseUrl: String(process.env.HOSTINGMCP_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    listen: process.env.HOSTINGMCP_MCP_LISTEN || '127.0.0.1:3101',
    toolsDeny: parseMcpToolsDeny(process.env.HOSTINGMCP_MCP_TOOLS_DENY),
    version: readVersion(),
    rateLimit: {
      windowMs: parseInt(process.env.HOSTINGMCP_MCP_RATE_WINDOW_MS || '60000', 10),
      maxPerWindow: parseInt(process.env.HOSTINGMCP_MCP_RATE_MAX || '120', 10),
    },
    concurrency: {
      maxConcurrent: parseInt(process.env.HOSTINGMCP_MCP_MAX_CONCURRENT || '4', 10),
      maxQueued: parseInt(process.env.HOSTINGMCP_MCP_MAX_QUEUED || '16', 10),
      queueTimeoutMs: parseInt(process.env.HOSTINGMCP_MCP_QUEUE_TIMEOUT_MS || '60000', 10),
    },
    readMaxBytes: parseInt(process.env.HOSTINGMCP_MCP_READ_MAX_BYTES || String(2 * 1024 * 1024), 10),
    writeMaxBytes: parseInt(process.env.HOSTINGMCP_MCP_WRITE_MAX_BYTES || String(5 * 1024 * 1024), 10),
    maxStorageMb: Math.max(0, parseInt(process.env.HOSTINGMCP_MAX_STORAGE_MB || '1024', 10) || 0),
  };
}

module.exports = { mcpConfig, parseKeysFromEnv, resolvePublicRoot, KEYS_MAX };
