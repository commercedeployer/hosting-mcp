# hosting-mcp

OSS Docker image: **static site hosting** + **Filebrowser** + **MCP** for AI agents.

One volume `public` is both the live website (nginx) and the only tree editable via `/files/` and `/mcp`. Write a file → it is live. No build step.

| Path | Role |
|------|------|
| `/` | Site from `/var/www/public` |
| `/files/` | [Filebrowser](https://filebrowser.org) (Ace editor) |
| `/mcp` | HTTP MCP (Bearer keys from env, max 5) |

## Quick start (dev)

```bash
cd hosting-mcp
docker compose -f docker-compose.dev.yml up --build
```

| URL | Notes |
|-----|--------|
| http://localhost:8088/ | Site |
| http://localhost:8088/files/ | `admin` / password from compose |
| http://localhost:8088/mcp | MCP endpoint |

## Environment

See [`.env.example`](.env.example) and [`mcp-server/docs/MCP-v1-RU.md`](mcp-server/docs/MCP-v1-RU.md).

| Variable | Purpose |
|----------|---------|
| `FILES_USER` / `FILES_PASSWORD` | Filebrowser login (`FILES_PASSWORD` required) |
| `HOSTINGMCP_MCP_KEYS` | Up to 5 Bearer keys, comma-separated |
| `HOSTINGMCP_MCP_KEY_1` … `_5` | Alternative / extra keys |
| `HOSTINGMCP_MCP_TOOLS_DENY` | Optional tool denylist |
| `HOSTINGMCP_PUBLIC_BASE_URL` | Public base URL (Cursor hints), no trailing slash |

Recommended key shape: `mch_mcp_live_…` (any long random secret works).

## MCP (agents)

| Doc | Audience |
|-----|----------|
| [`mcp-server/docs/MCP-AGENT-RU.md`](mcp-server/docs/MCP-AGENT-RU.md) | Agent playbook |
| [`mcp-server/docs/MCP-TOOLS-RU.md`](mcp-server/docs/MCP-TOOLS-RU.md) | Tool catalog |
| [`mcp-server/docs/MCP-v1-RU.md`](mcp-server/docs/MCP-v1-RU.md) | Human setup |
| [`mcp-server/docs/SITE-WORKFLOW-RU.md`](mcp-server/docs/SITE-WORKFLOW-RU.md) | Landing edit workflow |
| [`docs/AGENT-GUIDE-RU.md`](docs/AGENT-GUIDE-RU.md) | Workspace agent guide |

```bash
cd mcp-server
npm ci
npm test
```

## Published images (GitHub CI)

Account: **[commercedeployer](https://github.com/commercedeployer)** (same org as Deployer).

Workflow [`.github/workflows/publish-image.yml`](.github/workflows/publish-image.yml) on tag `v*`:

| Registry | Image |
|----------|--------|
| **GHCR** | `ghcr.io/commercedeployer/hosting-mcp:latest` |
| **Docker Hub** | `commercedeployer/hosting-mcp:latest` |

```bash
docker pull ghcr.io/commercedeployer/hosting-mcp:latest
# or
docker pull commercedeployer/hosting-mcp:latest
```

Release: push tag `v*` → CI builds and pushes both registries. **Do not** manually `docker build` + `docker push` release images.

Docker Hub needs secrets `DOCKERHUB_USERNAME` (`commercedeployer`) and `DOCKERHUB_TOKEN`. GHCR uses `GITHUB_TOKEN`.

CI on PR/main: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — unit tests + `docker build`.

## Deployer template

Operator template (Traefik labels, volumes):  
[`stores/deployer-templates/hosting-mcp.json`](../stores/deployer-templates/hosting-mcp.json)

## Architecture

```
client → nginx:80
           ├─ /        → /var/www/public
           ├─ /files/  → Filebrowser 127.0.0.1:8080
           └─ /mcp     → Node MCP 127.0.0.1:3101
```

## License

MIT — see [LICENSE](LICENSE).
