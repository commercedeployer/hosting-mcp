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
- Ключи MCP — только env (`HOSTINGMCP_MCP_KEYS`), до 5; не через MCP tools.
- Не путать с MyReady (Hugo), Commerce, Deployer.
- Релиз образа — только CI по тегу `v*`, не push руками.
- Оффер в Commerce — Hosting 1GB (Store); шаблон `hosting-mcp`: `NAME` + опциональный `CUSTOM_DOMAIN`, лимит диска `HOSTINGMCP_MAX_STORAGE_MB`.

## Старт MCP-сессии

1. `hostingmcp_capabilities`
2. Resource `hostingmcp://docs/mcp-agent`
3. `hostingmcp_files_*` для правок (live, без build)

## Шаблон Deployer

`stores/deployer-templates/hosting-mcp.json`
