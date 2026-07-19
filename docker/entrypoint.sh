#!/bin/sh
set -eu

PUBLIC_ROOT="${PUBLIC_ROOT:-/var/www/public}"
FB_DB="${FB_DB:-/var/lib/filebrowser/filebrowser.db}"
FILES_USER="${FILES_USER:-admin}"
FILES_PASSWORD="${FILES_PASSWORD:-}"
MCP_PORT="${MCP_PORT:-3101}"

mkdir -p "$PUBLIC_ROOT" /var/lib/filebrowser /var/log/mcp-hosting

if [ -z "$(ls -A "$PUBLIC_ROOT" 2>/dev/null || true)" ]; then
  if [ -f /opt/mcp-hosting/seed/index.html ]; then
    cp /opt/mcp-hosting/seed/index.html "$PUBLIC_ROOT/index.html"
    echo "[entrypoint] seeded public/index.html"
  fi
fi

if [ -z "$FILES_PASSWORD" ]; then
  echo "[entrypoint] ERROR: FILES_PASSWORD is required" >&2
  exit 1
fi

_pw_len=${#FILES_PASSWORD}
if [ "$FILES_PASSWORD" = "admin" ] || [ "$_pw_len" -lt 8 ]; then
  echo "[entrypoint] WARNING: FILES_PASSWORD is weak (default or shorter than 8). Use a strong secret before exposing to the internet." >&2
fi

if [ ! -f "$FB_DB" ]; then
  echo "[entrypoint] initializing Filebrowser database"
  filebrowser config init -d "$FB_DB"
  filebrowser config set -d "$FB_DB" \
    --root "$PUBLIC_ROOT" \
    --port 8080 \
    --address 127.0.0.1 \
    --baseURL "/files"
  filebrowser users add "$FILES_USER" "$FILES_PASSWORD" --perm.admin -d "$FB_DB"
else
  filebrowser config set -d "$FB_DB" \
    --root "$PUBLIC_ROOT" \
    --port 8080 \
    --address 127.0.0.1 \
    --baseURL "/files" || true
  if ! filebrowser users update "$FILES_USER" --password "$FILES_PASSWORD" --perm.admin -d "$FB_DB" >/dev/null 2>&1; then
    filebrowser users add "$FILES_USER" "$FILES_PASSWORD" --perm.admin -d "$FB_DB" || true
  fi
fi

echo "[entrypoint] starting Filebrowser on 127.0.0.1:8080"
filebrowser -d "$FB_DB" \
  --root "$PUBLIC_ROOT" \
  --address 127.0.0.1 \
  --port 8080 \
  --baseURL "/files" &

echo "[entrypoint] starting MCP on 127.0.0.1:${MCP_PORT}"
export MCPHOSTING_PUBLIC_ROOT="$PUBLIC_ROOT"
export MCPHOSTING_MCP_LISTEN="127.0.0.1:${MCP_PORT}"
cd /opt/mcp-hosting/mcp-server
node index.js &

echo "[entrypoint] starting nginx"
exec nginx -g 'daemon off;'
