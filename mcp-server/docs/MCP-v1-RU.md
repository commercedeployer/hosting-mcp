# hosting-mcp MCP — настройка (для человека)

## Что это

Один Docker-образ: сайт из `public`, Filebrowser на `/files/`, MCP на `/mcp`.

Образы релиза (org **commercedeployer**):

- `ghcr.io/commercedeployer/hosting-mcp:latest`
- `commercedeployer/hosting-mcp:latest`

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `FILES_USER` | Логин Filebrowser (по умолчанию `admin`) |
| `FILES_PASSWORD` | Пароль Filebrowser (**обязателен**) |
| `HOSTINGMCP_MCP_KEYS` | До **5** Bearer-ключей через запятую |
| `HOSTINGMCP_MCP_KEY_1` … `_5` | Альтернатива / дополнение к списку |
| `HOSTINGMCP_MCP_TOOLS_DENY` | Имена tools через запятую — скрыть |
| `HOSTINGMCP_PUBLIC_BASE_URL` | Публичный URL (для подсказок Cursor), без `/` в конце |

Рекомендуемый вид ключа: `mch_mcp_live_…` (любая длинная случайная строка).

Ключи **только в env** — UI выпуска ключей нет (намеренно, для простого хостинга).

## Cursor `.cursor/mcp.json`

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

Dev: `http://localhost:8088/mcp`.

## Локальный запуск

```bash
cd hosting-mcp
docker compose -f docker-compose.dev.yml up --build
```

- Сайт: http://localhost:8088/
- Файлы: http://localhost:8088/files/
- MCP: http://localhost:8088/mcp

## Deploy через Deployer

Шаблон: `stores/deployer-templates/hosting-mcp.json`  
Поля: домен, пароль `/files/`, строка MCP-ключей. Volume `public` + БД Filebrowser.

## Безопасность

- Не публикуй слабый `FILES_PASSWORD`.
- Ключи MCP — секреты; не коммить в git.
- MCP и Filebrowser видят **только** volume `public`.
- На VPS ставь образ из CI (`v*` тег), не собирай релиз руками.
