'use strict';

const crypto = require('node:crypto');
const { mcpConfig } = require('./mcpConfig');

function parseBearerAuthorization(header) {
  const raw = String(header || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

function timingSafeEqualString(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function createMcpKeyAuth(configOverride) {
  return function mcpKeyAuth(req, res, next) {
    const config = configOverride || mcpConfig();
    const token = parseBearerAuthorization(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Bearer token required' });
    }
    if (!config.keys.length) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: 'No MCP keys configured' });
    }

    let matchedIndex = -1;
    for (let i = 0; i < config.keys.length; i += 1) {
      if (timingSafeEqualString(token, config.keys[i])) {
        matchedIndex = i;
        break;
      }
    }
    if (matchedIndex < 0) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Invalid MCP key' });
    }

    req.mcpActor = {
      keyId: `env_key_${matchedIndex + 1}`,
      keyIndex: matchedIndex + 1,
      access: 'full',
    };
    return next();
  };
}

module.exports = {
  createMcpKeyAuth,
  parseBearerAuthorization,
  timingSafeEqualString,
};
