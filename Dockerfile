# hosting-mcp — nginx (static public) + Filebrowser (/files/) + MCP (/mcp)
ARG FB_VERSION=2.60.0

FROM node:26-alpine AS builder-mcp
WORKDIR /opt/hosting-mcp/mcp-server
COPY mcp-server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY mcp-server/ ./

FROM filebrowser/filebrowser:v${FB_VERSION} AS builder-filebrowser

FROM nginx:1.27-alpine

RUN apk add --no-cache nodejs ca-certificates \
  && mkdir -p /var/www/public /var/lib/filebrowser /opt/hosting-mcp

COPY --from=builder-filebrowser /bin/filebrowser /usr/local/bin/filebrowser
COPY --from=builder-mcp /opt/hosting-mcp/mcp-server /opt/hosting-mcp/mcp-server
COPY nginx/default.conf.template /opt/hosting-mcp/nginx/default.conf.template
COPY docker/entrypoint.sh /entrypoint.sh
COPY public/index.html /opt/hosting-mcp/seed/index.html
COPY VERSION /opt/hosting-mcp/VERSION

RUN chmod +x /entrypoint.sh /usr/local/bin/filebrowser \
  && sed -e 's|__MCP_BODY__|50m|g' -e 's|__FILES_BODY__|100m|g' \
       /opt/hosting-mcp/nginx/default.conf.template > /etc/nginx/conf.d/default.conf

ENV PUBLIC_ROOT=/var/www/public \
    HOSTINGMCP_PUBLIC_ROOT=/var/www/public \
    HOSTINGMCP_MCP_LISTEN=127.0.0.1:3101 \
    HOSTINGMCP_MAX_STORAGE_MB=1024 \
    HOSTINGMCP_MCP_MAX_UPLOAD_MB=25

VOLUME ["/var/www/public", "/var/lib/filebrowser"]
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
