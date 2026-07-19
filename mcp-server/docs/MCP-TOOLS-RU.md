# mcp-hosting — каталог MCP tools

Префикс: `mcphosting_`. Все пути относительно корня `public`.

## Meta

### mcphosting_capabilities
Аргументы: нет.  
Версия, число ключей, URL сайта /files /mcp.

### mcphosting_health
Аргументы: нет.  
Доступность `public` и наличие ключей.

### mcphosting_storage_usage
Аргументы: нет.  
`usedBytes`, число файлов и каталогов.

## Files

### mcphosting_files_list
`{ "path": "" }` — листинг каталога (пусто = корень).

### mcphosting_files_read
`{ "path": "index.html" }` — UTF-8 текст.

### mcphosting_files_write
`{ "path": "index.html", "content": "<!DOCTYPE html>…" }` — создать/перезаписать. Сразу на сайте.

### mcphosting_files_write_base64
`{ "path": "img/logo.png", "fileBase64": "…" }` — бинарные ассеты.

### mcphosting_files_mkdir
`{ "path": "css" }` — mkdir -p.

### mcphosting_files_move
`{ "from": "a.html", "to": "b.html" }` — rename/move внутри public.

### mcphosting_files_delete
`{ "path": "old.html" }` — **destructive**. Корень `public` нельзя.

### mcphosting_files_tree
`{ "path": "", "maxFiles": 500, "maxDepth": 6 }` — обход дерева.

### mcphosting_files_search
`{ "query": "index", "maxResults": 100 }` — поиск по подстроке в пути.
