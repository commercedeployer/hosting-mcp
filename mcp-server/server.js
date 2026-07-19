'use strict';

const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createMcpKeyAuth } = require('./auth');
const { createAllTools } = require('./toolRegistry');
const { createPromptRegistry, createResourceRegistry } = require('./resources');
const { loadServerInstructions } = require('./instructions');
const { createMcpConcurrencyGate } = require('./concurrencyGate');
const { mcpConfig } = require('./mcpConfig');
const {
  filterToolsByDenyPolicy,
  assertToolNotDeniedByPolicy,
} = require('./toolPolicy');

const PROTOCOL_VERSION = '2025-06-18';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function toolToMcpSchema(tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.destructive ? { destructiveHint: true } : undefined,
  };
}

function createMcpServer(configOverride) {
  const config = configOverride || mcpConfig();
  const allTools = createAllTools();
  const toolByName = new Map(allTools.map((t) => [t.name, t]));
  const prompts = createPromptRegistry();
  const resources = createResourceRegistry();
  const sessions = new Map();

  function pruneSessions() {
    const now = Date.now();
    for (const [id, row] of sessions) {
      if (now - row.createdAt > SESSION_TTL_MS) sessions.delete(id);
    }
  }

  function createSession(keyId) {
    pruneSessions();
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions.set(sessionId, { keyId: String(keyId), createdAt: Date.now() });
    return sessionId;
  }

  function touchSession(sessionId, keyId) {
    const row = sessions.get(String(sessionId || ''));
    if (!row || row.keyId !== String(keyId)) return false;
    row.createdAt = Date.now();
    return true;
  }

  function setMcpProtocolHeaders(res, sessionId) {
    res.setHeader('MCP-Protocol-Version', PROTOCOL_VERSION);
    if (sessionId) res.setHeader('Mcp-Session-Id', sessionId);
  }

  function requireMcpSession(req, res, next) {
    const method = req.body?.method;
    if (method === 'initialize') return next();
    const sessionId = req.get('mcp-session-id');
    if (!touchSession(sessionId, req.mcpActor?.keyId)) {
      return res.status(404).json(jsonRpcError(req.body?.id ?? null, -32600, 'Invalid or expired MCP session'));
    }
    return next();
  }

  const mcpAuth = createMcpKeyAuth(config);
  const rateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxPerWindow,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `mcp:${req.mcpActor?.keyId || req.ip}`,
    handler: (_req, res) => {
      res.status(429).json({ ok: false, error: 'mcp_rate_limited' });
    },
  });

  const toolCallGate = createMcpConcurrencyGate(config.concurrency);

  const router = express.Router();
  router.use(express.json({ limit: '6mb' }));

  router.get('/.well-known/oauth-protected-resource', (_req, res) => {
    const base = config.publicBaseUrl || '';
    res.json({
      resource: `${base.replace(/\/$/, '')}/mcp`,
      authorization_servers: [],
      bearer_methods_supported: ['header'],
      resource_documentation: `${base.replace(/\/$/, '')}/mcp`,
    });
  });

  router.get('/', mcpAuth, (_req, res) => {
    setMcpProtocolHeaders(res);
    res.setHeader('Allow', 'POST, DELETE');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
  });

  router.delete('/', mcpAuth, (req, res) => {
    const sessionId = req.get('mcp-session-id');
    if (sessionId) sessions.delete(String(sessionId));
    setMcpProtocolHeaders(res);
    res.status(204).end();
  });

  router.post('/', mcpAuth, requireMcpSession, rateLimiter, async (req, res) => {
    const actor = req.mcpActor;
    const body = req.body;
    const id = body?.id ?? null;
    const method = body?.method;

    if (!body || body.jsonrpc !== '2.0' || !method) {
      return res.status(400).json(jsonRpcError(id, -32600, 'Invalid Request'));
    }

    const ctx = { actor, config };

    try {
      if (method === 'initialize') {
        const sessionId = createSession(actor.keyId);
        setMcpProtocolHeaders(res, sessionId);
        return res.json(
          jsonRpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: { listChanged: true },
              prompts: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
            },
            serverInfo: { name: 'hosting-mcp', version: config.version },
            instructions: loadServerInstructions(),
          }),
        );
      }

      setMcpProtocolHeaders(res, req.get('mcp-session-id'));

      if (method === 'notifications/initialized') {
        return res.status(202).end();
      }

      if (method === 'ping') {
        return res.json(jsonRpcResult(id, {}));
      }

      if (method === 'tools/list') {
        const visible = filterToolsByDenyPolicy(allTools, config.toolsDeny);
        return res.json(jsonRpcResult(id, { tools: visible.map(toolToMcpSchema) }));
      }

      if (method === 'tools/call') {
        const name = body.params?.name;
        const args = body.params?.arguments || {};
        const tool = toolByName.get(name);
        if (!tool) {
          return res.json(jsonRpcError(id, -32601, `Unknown tool: ${name}`));
        }
        assertToolNotDeniedByPolicy(name, config.toolsDeny);

        const result = await toolCallGate.run(async () => tool.handler(ctx, args));
        return res.json(
          jsonRpcResult(id, {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result,
          }),
        );
      }

      if (method === 'prompts/list') {
        return res.json(jsonRpcResult(id, { prompts: prompts.list() }));
      }

      if (method === 'prompts/get') {
        const name = body.params?.name;
        const args = body.params?.arguments || {};
        const got = await prompts.get(name, args);
        return res.json(jsonRpcResult(id, got));
      }

      if (method === 'resources/list') {
        return res.json(jsonRpcResult(id, { resources: resources.list() }));
      }

      if (method === 'resources/read') {
        const uri = body.params?.uri;
        const got = await resources.read(uri);
        return res.json(jsonRpcResult(id, got));
      }

      return res.json(jsonRpcError(id, -32601, `Method not found: ${method}`));
    } catch (err) {
      const code = err.code || 'tool_error';
      const message = err.message || String(err);
      if (code === 'mcp_server_busy' || code === 'mcp_queue_timeout') {
        return res.status(503).json({ ok: false, error: code, message });
      }
      return res.json(
        jsonRpcResult(id, {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ ok: false, error: code, message }) }],
        }),
      );
    }
  });

  return router;
}

module.exports = { createMcpServer, PROTOCOL_VERSION };
