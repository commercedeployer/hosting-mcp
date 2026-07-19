'use strict';

const { readMcpDoc } = require('./instructions');
const { mcpConfig } = require('./mcpConfig');
const { createAllTools } = require('./toolRegistry');

function createResourceRegistry() {
  const staticDocs = [
    {
      uri: 'hostingmcp://docs/mcp-agent',
      name: 'MCP agent playbook',
      description: 'START HERE — how to operate hosting-mcp via MCP',
      mimeType: 'text/markdown',
      file: 'MCP-AGENT-RU.md',
    },
    {
      uri: 'hostingmcp://docs/mcp-tools',
      name: 'MCP tools catalog',
      description: 'All tools with arguments',
      mimeType: 'text/markdown',
      file: 'MCP-TOOLS-RU.md',
    },
    {
      uri: 'hostingmcp://docs/mcp-setup',
      name: 'MCP setup (human)',
      description: 'Env keys, Cursor mcp.json, URLs',
      mimeType: 'text/markdown',
      file: 'MCP-v1-RU.md',
    },
    {
      uri: 'hostingmcp://docs/site-workflow',
      name: 'Site workflow',
      description: 'How to build/edit a static landing in realtime',
      mimeType: 'text/markdown',
      file: 'SITE-WORKFLOW-RU.md',
    },
  ];

  return {
    list() {
      return [
        ...staticDocs.map(({ uri, name, description, mimeType }) => ({
          uri,
          name,
          description,
          mimeType,
        })),
        {
          uri: 'hostingmcp://capabilities',
          name: 'Live capabilities',
          description: 'JSON snapshot of version and key slots',
          mimeType: 'application/json',
        },
      ];
    },

    async read(uri) {
      if (uri === 'hostingmcp://capabilities') {
        const cfg = mcpConfig();
        const tools = createAllTools().map((t) => t.name);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(
                {
                  product: 'hosting-mcp',
                  version: cfg.version,
                  keysConfigured: cfg.keys.length,
                  keysMax: cfg.keysMax,
                  publicRoot: cfg.publicRoot,
                  publicBaseUrl: cfg.publicBaseUrl || null,
                  tools,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const doc = staticDocs.find((d) => d.uri === uri);
      if (!doc) {
        const err = new Error('resource_not_found');
        err.code = 'resource_not_found';
        throw err;
      }
      const { text, mimeType } = readMcpDoc(doc.file);
      return { contents: [{ uri, mimeType, text }] };
    },
  };
}

function createPromptRegistry() {
  const prompts = [
    {
      name: 'hostingmcp_agent_onboarding',
      title: 'Agent onboarding',
      description: 'First-session checklist for hosting-mcp',
      arguments: [],
      async messages() {
        return {
          description: 'Onboarding',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  'You are connected to hosting-mcp MCP.',
                  '1) Call hostingmcp_capabilities and hostingmcp_health.',
                  '2) Read resource hostingmcp://docs/mcp-agent.',
                  '3) hostingmcp_files_tree on public root.',
                  '4) Edits via hostingmcp_files_write are live — no build step.',
                  '5) Human file UI is /files/ (Filebrowser); do not manage MCP keys via tools.',
                ].join('\n'),
              },
            },
          ],
        };
      },
    },
    {
      name: 'hostingmcp_landing_edit',
      title: 'Edit landing',
      description: 'Workflow to change the homepage',
      arguments: [
        {
          name: 'goal',
          description: 'What to change on the landing (headline, section, style)',
          required: false,
        },
      ],
      async messages(args) {
        const goal = String(args?.goal || 'improve the homepage').trim();
        return {
          description: 'Landing edit',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  `Goal: ${goal}`,
                  '1) hostingmcp_files_read path=index.html (and linked css/js).',
                  '2) Plan minimal HTML/CSS/JS changes.',
                  '3) hostingmcp_files_write the files.',
                  '4) Tell the user to refresh / — changes are live.',
                ].join('\n'),
              },
            },
          ],
        };
      },
    },
    {
      name: 'hostingmcp_fix_broken_page',
      title: 'Fix broken page',
      description: 'Diagnose missing assets or broken links under public',
      arguments: [
        {
          name: 'path',
          description: 'HTML file path under public (default index.html)',
          required: false,
        },
      ],
      async messages(args) {
        const p = String(args?.path || 'index.html').trim();
        return {
          description: 'Fix page',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  `Inspect ${p}:`,
                  '1) hostingmcp_files_read the HTML.',
                  '2) hostingmcp_files_search / tree for referenced css/js/img.',
                  '3) Fix missing paths or recreate assets; write via MCP.',
                  '4) Confirm with hostingmcp_files_list.',
                ].join('\n'),
              },
            },
          ],
        };
      },
    },
  ];

  const byName = new Map(prompts.map((p) => [p.name, p]));

  return {
    list() {
      return prompts.map(({ name, title, description, arguments: a }) => ({
        name,
        title,
        description,
        arguments: a,
      }));
    },
    async get(name, args) {
      const p = byName.get(name);
      if (!p) {
        const err = new Error('prompt_not_found');
        err.code = 'prompt_not_found';
        throw err;
      }
      return p.messages(args || {});
    },
  };
}

module.exports = { createResourceRegistry, createPromptRegistry };
