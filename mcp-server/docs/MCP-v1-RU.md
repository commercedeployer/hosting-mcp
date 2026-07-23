# hosting-mcp MCP — настройка (для человека)

## Что это

Один Docker-образ: сайт из `public`, Filebrowser на `/files/`, MCP на `/mcp`.

Образы: `ghcr.io/commercedeployer/hosting-mcp:latest` / `commercedeployer/hosting-mcp:latest`.

## Переменные окружения

Только то, что реально настраивают. Остальное (rate limit, режимы файлов, JSON/nginx body) считается из дефолтов и `HOSTINGMCP_MCP_MAX_UPLOAD_MB`.

### Доступ

| Переменная | Default | Назначение |
|------------|---------|------------|
| `FILES_PASSWORD` | — | Пароль `/files/` (**обязателен**) |
| `FILES_USER` | `admin` | Логин Filebrowser |
| `HOSTINGMCP_MCP_KEYS` | — | До 5 Bearer-ключей через запятую |
| `HOSTINGMCP_MCP_KEY_1` … `_5` | — | Доп. ключи |
| `HOSTINGMCP_MCP_TOOLS_DENY` | — | Скрыть tools (имена через запятую) |

### URL

| Переменная | Default | Назначение |
|------------|---------|------------|
| `HOSTINGMCP_PUBLIC_BASE_URL` | из FREE/CUSTOM | Публичный URL без `/` |
| `HOSTINGMCP_FREE_HOST` | — | Бесплатный хост |
| `HOSTINGMCP_CUSTOM_DOMAIN` | — | Свой домен (301 с FREE, если другой) |

### Квоты

| Переменная | Default | Назначение |
|------------|---------|------------|
| `HOSTINGMCP_MAX_STORAGE_MB` | `1024` | Мягкий лимит диска для MCP-записи |
| `HOSTINGMCP_MCP_MAX_UPLOAD_MB` | `25` | Один рычаг: макс. файл/zip через MCP; от него считаются JSON body и nginx `/mcp` |

Ключ: `mch_mcp_live_…`. Выпуск только через env.

Пример: [`.env.example`](../../.env.example).

## Cursor

```json
{
  "mcpServers": {
    "hosting-mcp": {
      "url": "https://YOUR_DOMAIN/mcp",
      "headers": {
        "Authorization": "Bearer mch_mcp_live_ВАШ_КЛЮЧ"
      }
    }
  }
}
```

## Локально

```bash
docker compose -f docker-compose.dev.yml up --build
```

Сайт / files / mcp: `http://localhost:8088/`, `/files/`, `/mcp`.

## Безопасность

Слабый `FILES_PASSWORD` не публиковать. Ключи не в git. Релиз образа — только CI по тегу `v*`.
