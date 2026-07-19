'use strict';

const { createHandlers } = require('./toolHandlers');

const PATH_PROP = {
  type: 'string',
  description: 'Path relative to public root (no leading slash, no ..)',
};

function createAllTools() {
  const handlers = createHandlers();

  const defs = [
    {
      name: 'hostingmcp_capabilities',
      title: 'Capabilities',
      description: 'Product version, key slots, public URLs. Call first in a session.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: handlers.hostingmcp_capabilities,
    },
    {
      name: 'hostingmcp_health',
      title: 'Health',
      description: 'Check that public root exists and MCP keys are configured.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: handlers.hostingmcp_health,
    },
    {
      name: 'hostingmcp_storage_usage',
      title: 'Storage usage',
      description: 'Count files/dirs and used bytes under public root.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: handlers.hostingmcp_storage_usage,
    },
    {
      name: 'hostingmcp_files_list',
      title: 'List directory',
      description: 'List files and folders in a path under public.',
      inputSchema: {
        type: 'object',
        properties: { path: { ...PATH_PROP, description: 'Directory path; empty or omit for root' } },
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_list,
    },
    {
      name: 'hostingmcp_files_read',
      title: 'Read file',
      description: 'Read a UTF-8 text file from public (HTML/CSS/JS/MD).',
      inputSchema: {
        type: 'object',
        properties: { path: PATH_PROP },
        required: ['path'],
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_read,
    },
    {
      name: 'hostingmcp_files_write',
      title: 'Write file',
      description: 'Create or overwrite a UTF-8 text file under public. Live site updates immediately.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH_PROP,
          content: { type: 'string', description: 'Full file contents' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_write,
    },
    {
      name: 'hostingmcp_files_write_base64',
      title: 'Write binary file',
      description: 'Write binary asset (image/font) from base64 under public.',
      inputSchema: {
        type: 'object',
        properties: {
          path: PATH_PROP,
          fileBase64: { type: 'string', description: 'Base64-encoded bytes' },
        },
        required: ['path', 'fileBase64'],
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_write_base64,
    },
    {
      name: 'hostingmcp_files_mkdir',
      title: 'Create directory',
      description: 'Create a directory (recursive) under public.',
      inputSchema: {
        type: 'object',
        properties: { path: PATH_PROP },
        required: ['path'],
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_mkdir,
    },
    {
      name: 'hostingmcp_files_move',
      title: 'Move / rename',
      description: 'Move or rename a file/directory within public.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { ...PATH_PROP, description: 'Source path' },
          to: { ...PATH_PROP, description: 'Destination path' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_move,
    },
    {
      name: 'hostingmcp_files_delete',
      title: 'Delete path',
      description: 'Delete a file or directory under public. Cannot delete public root.',
      destructive: true,
      inputSchema: {
        type: 'object',
        properties: { path: PATH_PROP },
        required: ['path'],
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_delete,
    },
    {
      name: 'hostingmcp_files_tree',
      title: 'Walk tree',
      description: 'Shallow recursive listing of public (or a subdirectory).',
      inputSchema: {
        type: 'object',
        properties: {
          path: { ...PATH_PROP, description: 'Start directory; empty for root' },
          maxFiles: { type: 'integer', minimum: 1, maximum: 2000 },
          maxDepth: { type: 'integer', minimum: 1, maximum: 12 },
        },
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_tree,
    },
    {
      name: 'hostingmcp_files_search',
      title: 'Search by name',
      description: 'Find paths under public whose relative path contains the query (case-insensitive).',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Substring to match in path' },
          maxResults: { type: 'integer', minimum: 1, maximum: 500 },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: handlers.hostingmcp_files_search,
    },
  ];

  return defs;
}

module.exports = { createAllTools };
