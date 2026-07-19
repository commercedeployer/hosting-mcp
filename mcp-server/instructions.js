'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DOC_ROOT = path.join(__dirname, 'docs');
const AGENT_DOC = 'MCP-AGENT-RU.md';
const INSTRUCTIONS_MAX = 12000;

function readMcpDoc(relativePath, maxChars = 48000) {
  const file = path.join(DOC_ROOT, relativePath);
  if (!fs.existsSync(file)) {
    return { text: `# Missing MCP doc: ${relativePath}\n`, mimeType: 'text/markdown' };
  }
  const raw = fs.readFileSync(file, 'utf8');
  const text = raw.length > maxChars ? `${raw.slice(0, maxChars)}\n\n…[truncated — read full resource]` : raw;
  return { text, mimeType: 'text/markdown' };
}

function loadServerInstructions() {
  const file = path.join(DOC_ROOT, AGENT_DOC);
  if (!fs.existsSync(file)) {
    return [
      'mcp-hosting: call mcphosting_capabilities, read resource mcphosting://docs/mcp-agent.',
      'Edit static site via mcphosting_files_*; writes are live (no build).',
      'Access only the public folder. Not Commerce, Deployer, or MyReady MCP.',
    ].join('\n');
  }
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.length <= INSTRUCTIONS_MAX) return raw;
  return `${raw.slice(0, INSTRUCTIONS_MAX)}\n\n…[full playbook: resource mcphosting://docs/mcp-agent]`;
}

module.exports = { readMcpDoc, loadServerInstructions, DOC_ROOT };
