# hosting-mcp MCP — playbook для агента

Документ для **агента** (Cursor, Claude), подключённого к hosting-mcp MCP (`POST …/mcp`, Bearer из env).

Человеку: resource `hostingmcp://docs/mcp-setup` / файл [`MCP-v1-RU.md`](MCP-v1-RU.md).

---

## 1. Что ты управляешь

**hosting-mcp** — один контейнер: статический сайт из папки `public`, Filebrowser на `/files/`, MCP на `/mcp`.

| Через MCP | Не твой контур |
|-----------|----------------|
| Чтение/запись файлов в `public` | Commerce (магазин, биллинг) |
| Дерево, поиск, mkdir/move/delete | Deployer (Docker на хосте) |
| Live-правки лендинга (без сборки) | MyReady (Hugo CMS) |

Ключи задаёт оператор в **переменных окружения** (до 5). Через MCP ключи **нельзя** выпускать или отзывать.

---

## 2. Первые 30 секунд

```
1. hostingmcp_capabilities
2. hostingmcp_health
3. resource hostingmcp://docs/mcp-agent (этот файл)
4. hostingmcp_files_tree { path: "" }
```

Prompt: `hostingmcp_agent_onboarding`.

---

## 3. Правила путей

- Все пути **относительно** корня `public` (например `index.html`, `css/main.css`).
- Запрещены `..`, абсолютные пути вне root → `path_escape`.
- Запись в файл = сразу на сайте (nginx отдаёт тот же volume). **Сборки нет.**

---

## 4. Tools (кратко)

| Группа | Tools |
|--------|--------|
| Meta | `hostingmcp_capabilities`, `hostingmcp_health`, `hostingmcp_storage_usage` |
| Files | `hostingmcp_files_list/read/write/write_base64/mkdir/move/delete/tree/search` |

Destructive: `hostingmcp_files_delete` — только по явной просьбе пользователя. Нельзя удалить корень `public`.

Полный каталог: `hostingmcp://docs/mcp-tools`.

---

## 5. Типовой сценарий — лендинг

```
hostingmcp_files_read { path: "index.html" }
 → правки HTML/CSS/JS
hostingmcp_files_write { path: "index.html", content: "…" }
 → пользователь обновляет / в браузере
```

Картинки: `hostingmcp_files_write_base64` или человек через `/files/`.

Workflow: `hostingmcp://docs/site-workflow`, prompt `hostingmcp_landing_edit`.

---

## 6. Ошибки

| Симптом | Действие |
|---------|----------|
| 401 unauthorized | Нет/неверный Bearer; проверь env `HOSTINGMCP_MCP_KEYS` |
| `path_escape` | Убери `..` / абсолютный путь |
| `tool_disabled_by_policy` | Tool в `HOSTINGMCP_MCP_TOOLS_DENY` |
| 503 `mcp_server_busy` | Повтори через 2–5 с |

---

## 7. Чеклист завершения

- [ ] `hostingmcp_capabilities` в начале
- [ ] Правки только в `public`
- [ ] Destructive — было согласие
- [ ] Не путать с Commerce / Deployer / MyReady
- [ ] Краткий отчёт: какие файлы изменены
