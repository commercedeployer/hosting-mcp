'use strict';

const fs = require('node:fs');
const { mcpConfig } = require('./mcpConfig');
const jail = require('./fsJail');

function ok(data) {
  return { ok: true, ...data };
}

function cfgOf(ctx) {
  return ctx?.config || mcpConfig();
}

async function mcphosting_capabilities(ctx) {
  const cfg = cfgOf(ctx);
  return ok({
    product: 'mcp-hosting',
    version: cfg.version,
    access: 'full',
    keysConfigured: cfg.keys.length,
    keysMax: cfg.keysMax,
    publicRoot: cfg.publicRoot,
    publicBaseUrl: cfg.publicBaseUrl || null,
    mcpUrl: cfg.publicBaseUrl ? `${cfg.publicBaseUrl}/mcp` : null,
    filesUrl: cfg.publicBaseUrl ? `${cfg.publicBaseUrl}/files/` : '/files/',
  });
}

async function mcphosting_health(ctx) {
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

async function mcphosting_storage_usage(ctx) {
  const cfg = cfgOf(ctx);
  return ok(jail.diskUsage(cfg.publicRoot));
}

async function mcphosting_files_list(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.listDir(cfg.publicRoot, args?.path || ''));
}

async function mcphosting_files_read(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.readTextFile(cfg.publicRoot, args?.path, cfg.readMaxBytes));
}

async function mcphosting_files_write(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.writeTextFile(cfg.publicRoot, args?.path, args?.content, cfg.writeMaxBytes));
}

async function mcphosting_files_write_base64(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.writeBase64File(cfg.publicRoot, args?.path, args?.fileBase64, cfg.writeMaxBytes));
}

async function mcphosting_files_mkdir(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.mkdirp(cfg.publicRoot, args?.path));
}

async function mcphosting_files_move(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.movePath(cfg.publicRoot, args?.from, args?.to));
}

async function mcphosting_files_delete(ctx, args) {
  const cfg = cfgOf(ctx);
  return ok(await jail.deletePath(cfg.publicRoot, args?.path));
}

async function mcphosting_files_tree(ctx, args) {
  const cfg = cfgOf(ctx);
  const maxFiles = Math.min(Number(args?.maxFiles) || 500, 2000);
  const maxDepth = Math.min(Number(args?.maxDepth) || 6, 12);
  return ok(await jail.walkTree(cfg.publicRoot, args?.path || '', { maxFiles, maxDepth }));
}

async function mcphosting_files_search(ctx, args) {
  const cfg = cfgOf(ctx);
  const maxResults = Math.min(Number(args?.maxResults) || 100, 500);
  return ok(await jail.searchFiles(cfg.publicRoot, args?.query || args?.q, { maxResults }));
}

function createHandlers() {
  return {
    mcphosting_capabilities,
    mcphosting_health,
    mcphosting_storage_usage,
    mcphosting_files_list,
    mcphosting_files_read,
    mcphosting_files_write,
    mcphosting_files_write_base64,
    mcphosting_files_mkdir,
    mcphosting_files_move,
    mcphosting_files_delete,
    mcphosting_files_tree,
    mcphosting_files_search,
  };
}

module.exports = { createHandlers };
