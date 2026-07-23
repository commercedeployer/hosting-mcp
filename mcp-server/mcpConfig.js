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

function parsePositiveInt(raw, fallback) {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * One public knob: HOSTINGMCP_MCP_MAX_UPLOAD_MB (default 25).
 * Derives write/json/import ceilings so operators do not tune 5 related vars.
 */
function resolveUploadLimits() {
  const uploadMb = parsePositiveInt(process.env.HOSTINGMCP_MCP_MAX_UPLOAD_MB, 25);
  const writeMaxBytes = uploadMb * 1024 * 1024;
  // base64 ≈ +33% + MCP JSON envelope
  const jsonBodyLimit = `${Math.max(40, Math.ceil(uploadMb * 1.6))}mb`;
  // zip may expand; keep a floor so a full small site still fits
  const importMaxUncompressedBytes = Math.max(100, uploadMb * 4) * 1024 * 1024;
  const readMaxBytes = 2 * 1024 * 1024;
  return { uploadMb, writeMaxBytes, jsonBodyLimit, importMaxUncompressedBytes, readMaxBytes };
}

function mcpConfig() {
  const keys = parseKeysFromEnv();
  const limits = resolveUploadLimits();
  return {
    keys,
    keysMax: KEYS_MAX,
    publicRoot: resolvePublicRoot(),
    publicBaseUrl: String(process.env.HOSTINGMCP_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    listen: process.env.HOSTINGMCP_MCP_LISTEN || '127.0.0.1:3101',
    toolsDeny: parseMcpToolsDeny(process.env.HOSTINGMCP_MCP_TOOLS_DENY),
    version: readVersion(),
    rateLimit: {
      windowMs: 60_000,
      maxPerWindow: 120,
    },
    concurrency: {
      maxConcurrent: 4,
      maxQueued: 16,
      queueTimeoutMs: 60_000,
    },
    maxUploadMb: limits.uploadMb,
    readMaxBytes: limits.readMaxBytes,
    writeMaxBytes: limits.writeMaxBytes,
    jsonBodyLimit: limits.jsonBodyLimit,
    importMaxUncompressedBytes: limits.importMaxUncompressedBytes,
    maxStorageMb: (() => {
      const raw = process.env.HOSTINGMCP_MAX_STORAGE_MB;
      if (raw === undefined || raw === '') return 1024;
      const n = parseInt(String(raw), 10);
      if (!Number.isFinite(n) || n < 0) return 1024;
      return n;
    })(),
  };
}

module.exports = {
  mcpConfig,
  parseKeysFromEnv,
  resolvePublicRoot,
  resolveUploadLimits,
  KEYS_MAX,
};
