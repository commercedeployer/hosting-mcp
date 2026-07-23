# hosting-mcp — гайд для AI-агента

## Что это

OSS-сосед workspace: Docker-образ **nginx + Filebrowser + MCP** для статического хостинга папки `public`.

Org GitHub / образы: **commercedeployer/hosting-mcp** (GHCR + Docker Hub), как Deployer.

## Где код

| Путь | Роль |
|------|------|
| `Dockerfile`, `docker/entrypoint.sh`, `nginx/` | runtime-образ |
| `public/` | seed / bind-mount сайта |
| `mcp-server/` | HTTP MCP на `/mcp` |
| `mcp-server/docs/` | AGENT / TOOLS / setup / workflow |
| `.github/workflows/` | CI + publish-image |

## Правила

- Правки сайта — только дерево `public` (path jail).
- Ключи MCP — env `HOSTINGMCP_MCP_KEYS` (до 5).
- Квоты: `HOSTINGMCP_MAX_STORAGE_MB` (диск), `HOSTINGMCP_MCP_MAX_UPLOAD_MB` (один рычаг размера MCP-загрузки).
- Не путать с MyReady / Commerce / Deployer.
- Релиз образа — только CI по тегу `v*`.
- Оффер в Commerce: шаблон `hosting-mcp` (`NAME`, `CUSTOM_DOMAIN`, …) — сам Commerce не правим из этого репо.

## Старт MCP-сессии

1. `hostingmcp_capabilities`
2. Resource `hostingmcp://docs/mcp-agent`
3. `hostingmcp_files_*` для правок (live, без build); целый сайт — `hostingmcp_files_import_zip`
4. `hostingmcp_site_smoke` после выкладки

## Шаблон Deployer

`stores/deployer-templates/hosting-mcp.json`
