#!/bin/sh
set -eu

PUBLIC_ROOT="${PUBLIC_ROOT:-/var/www/public}"
FB_DB="${FB_DB:-/var/lib/filebrowser/filebrowser.db}"
FILES_USER="${FILES_USER:-admin}"
FILES_PASSWORD="${FILES_PASSWORD:-}"
MCP_PORT="${MCP_PORT:-3101}"
FREE_HOST="${HOSTINGMCP_FREE_HOST:-}"
CUSTOM_DOMAIN="${HOSTINGMCP_CUSTOM_DOMAIN:-}"
MAX_STORAGE_MB="${HOSTINGMCP_MAX_STORAGE_MB:-1024}"

mkdir -p "$PUBLIC_ROOT" /var/lib/filebrowser /var/log/hosting-mcp /etc/nginx/conf.d

# Soft storage default for MCP writes (Filebrowser is not hard-capped).
export HOSTINGMCP_MAX_STORAGE_MB="$MAX_STORAGE_MB"

# Primary public URL: custom domain when set and different from free host.
if [ -n "$CUSTOM_DOMAIN" ] && [ -n "$FREE_HOST" ] && [ "$CUSTOM_DOMAIN" != "$FREE_HOST" ]; then
  export HOSTINGMCP_PUBLIC_BASE_URL="https://${CUSTOM_DOMAIN}"
elif [ -n "$CUSTOM_DOMAIN" ]; then
  export HOSTINGMCP_PUBLIC_BASE_URL="https://${CUSTOM_DOMAIN}"
elif [ -n "$FREE_HOST" ]; then
  export HOSTINGMCP_PUBLIC_BASE_URL="https://${FREE_HOST}"
fi

# SEO: when custom domain is primary, 301 from free *.d-commerce.ru host.
REDIRECT_CONF="/etc/nginx/conf.d/00-free-to-custom-redirect.conf"
rm -f "$REDIRECT_CONF"
if [ -n "$CUSTOM_DOMAIN" ] && [ -n "$FREE_HOST" ] && [ "$CUSTOM_DOMAIN" != "$FREE_HOST" ]; then
  cat > "$REDIRECT_CONF" <<EOF
# Free third-level host → custom domain (301, SEO)
server {
    listen 80;
    server_name ${FREE_HOST};
    return 301 https://${CUSTOM_DOMAIN}\$request_uri;
}
EOF
  echo "[entrypoint] 301 ${FREE_HOST} → https://${CUSTOM_DOMAIN}"
fi

if [ -z "$(ls -A "$PUBLIC_ROOT" 2>/dev/null || true)" ]; then
  if [ -f /opt/hosting-mcp/seed/index.html ]; then
    cp /opt/hosting-mcp/seed/index.html "$PUBLIC_ROOT/index.html"
    echo "[entrypoint] seeded public/index.html"
  fi
fi

if [ -z "$FILES_PASSWORD" ]; then
  echo "[entrypoint] ERROR: FILES_PASSWORD is required" >&2
  exit 1
fi

_pw_len=${#FILES_PASSWORD}
if [ "$FILES_PASSWORD" = "admin" ] || [ "$_pw_len" -lt 12 ]; then
  echo "[entrypoint] WARNING: FILES_PASSWORD is weak (default or shorter than 12). Use a strong secret before exposing to the internet." >&2
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

echo "[entrypoint] starting MCP on 127.0.0.1:${MCP_PORT} (max storage ${MAX_STORAGE_MB} MB)"
export HOSTINGMCP_PUBLIC_ROOT="$PUBLIC_ROOT"
export HOSTINGMCP_MCP_LISTEN="127.0.0.1:${MCP_PORT}"
cd /opt/hosting-mcp/mcp-server
node index.js &

echo "[entrypoint] starting nginx"
exec nginx -g 'daemon off;'
