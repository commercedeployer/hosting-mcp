# hosting-mcp — каталог MCP tools

Префикс: `hostingmcp_`. Все пути относительно корня `public`.

## Meta

### hostingmcp_capabilities
Аргументы: нет.  
Версия, число ключей, URL сайта /files /mcp.

### hostingmcp_health
Аргументы: нет.  
Доступность `public` и наличие ключей.

### hostingmcp_storage_usage
Аргументы: нет.  
`usedBytes`, число файлов и каталогов.

## Files

### hostingmcp_site_smoke
Аргументы: нет.  
Есть ли `index.html`, ответ локального nginx на `HEAD /` (best-effort).

### hostingmcp_files_list
`{ "path": "" }` — листинг каталога (пусто = корень).

### hostingmcp_files_read
`{ "path": "index.html" }` — UTF-8 текст.

### hostingmcp_files_write
`{ "path": "index.html", "content": "<!DOCTYPE html>…" }` — создать/перезаписать. Сразу на сайте.

### hostingmcp_files_write_base64
`{ "path": "assets/video/hero.webm", "fileBase64": "…" }` — бинарные ассеты (картинки, видео, шрифты).

Лимит: env **`HOSTINGMCP_MCP_MAX_UPLOAD_MB`** (по умолчанию **25**). В capabilities — `maxUploadMb` / `writeMaxBytes`. Крупнее — `/files/`.

### hostingmcp_files_import_zip
`{ "fileBase64": "…", "destPath": "" }` — распаковать zip в `public`. Архив ≤ upload limit; распакованное — до ~4× upload (мин. 100 MiB) и квота `HOSTINGMCP_MAX_STORAGE_MB`.

### hostingmcp_files_mkdir
`{ "path": "css" }` — mkdir -p.

### hostingmcp_files_move
`{ "from": "a.html", "to": "b.html" }` — rename/move внутри public (без лимита размера).

### hostingmcp_files_copy
`{ "from": "a.html", "to": "b.html" }` — копирование (рекурсивно для каталогов); `to` не должен существовать.

### hostingmcp_files_delete
`{ "path": "old.html" }` — **destructive**. Корень `public` нельзя.

### hostingmcp_files_tree
`{ "path": "", "maxFiles": 500, "maxDepth": 6 }` — обход дерева.

### hostingmcp_files_search
`{ "query": "index", "maxResults": 100 }` — поиск по подстроке в пути.
