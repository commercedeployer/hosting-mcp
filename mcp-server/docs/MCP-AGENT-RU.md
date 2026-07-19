# mcp-hosting MCP — playbook для агента

Документ для **агента** (Cursor, Claude), подключённого к mcp-hosting MCP (`POST …/mcp`, Bearer из env).

Человеку: resource `mcphosting://docs/mcp-setup` / файл [`MCP-v1-RU.md`](MCP-v1-RU.md).

---

## 1. Что ты управляешь

**mcp-hosting** — один контейнер: статический сайт из папки `public`, Filebrowser на `/files/`, MCP на `/mcp`.

| Через MCP | Не твой контур |
|-----------|----------------|
| Чтение/запись файлов в `public` | Commerce (магазин, биллинг) |
| Дерево, поиск, mkdir/move/delete | Deployer (Docker на хосте) |
| Live-правки лендинга (без сборки) | MyReady (Hugo CMS) |

Ключи задаёт оператор в **переменных окружения** (до 5). Через MCP ключи **нельзя** выпускать или отзывать.

---

## 2. Первые 30 секунд

```
1. mcphosting_capabilities
2. mcphosting_health
3. resource mcphosting://docs/mcp-agent (этот файл)
4. mcphosting_files_tree { path: "" }
```

Prompt: `mcphosting_agent_onboarding`.

---

## 3. Правила путей

- Все пути **относительно** корня `public` (например `index.html`, `css/main.css`).
- Запрещены `..`, абсолютные пути вне root → `path_escape`.
- Запись в файл = сразу на сайте (nginx отдаёт тот же volume). **Сборки нет.**

---

## 4. Tools (кратко)

| Группа | Tools |
|--------|--------|
| Meta | `mcphosting_capabilities`, `mcphosting_health`, `mcphosting_storage_usage` |
| Files | `mcphosting_files_list/read/write/write_base64/mkdir/move/delete/tree/search` |

Destructive: `mcphosting_files_delete` — только по явной просьбе пользователя. Нельзя удалить корень `public`.

Полный каталог: `mcphosting://docs/mcp-tools`.

---

## 5. Типовой сценарий — лендинг

```
mcphosting_files_read { path: "index.html" }
 → правки HTML/CSS/JS
mcphosting_files_write { path: "index.html", content: "…" }
 → пользователь обновляет / в браузере
```

Картинки: `mcphosting_files_write_base64` или человек через `/files/`.

Workflow: `mcphosting://docs/site-workflow`, prompt `mcphosting_landing_edit`.

---

## 6. Ошибки

| Симптом | Действие |
|---------|----------|
| 401 unauthorized | Нет/неверный Bearer; проверь env `MCPHOSTING_MCP_KEYS` |
| `path_escape` | Убери `..` / абсолютный путь |
| `tool_disabled_by_policy` | Tool в `MCPHOSTING_MCP_TOOLS_DENY` |
| 503 `mcp_server_busy` | Повтори через 2–5 с |

---

## 7. Чеклист завершения

- [ ] `mcphosting_capabilities` в начале
- [ ] Правки только в `public`
- [ ] Destructive — было согласие
- [ ] Не путать с Commerce / Deployer / MyReady
- [ ] Краткий отчёт: какие файлы изменены
