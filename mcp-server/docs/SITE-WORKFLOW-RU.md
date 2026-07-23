# Workflow: статический сайт в realtime

## Модель

Один volume `public` = DocumentRoot nginx. Правка файла через MCP или Filebrowser сразу видна на `/`.

Нет Hugo, нет `build_run`, нет PHP.

## С чего начать

1. `hostingmcp_files_tree` — что уже есть.
2. Прочитать `index.html` и связанные `*.css` / `*.js`.
3. Менять минимально: один экран — один смысловой блок.

## Рекомендуемая структура

```
public/
  index.html
  css/main.css
  js/main.js
  img/
```

Каталоги — `hostingmcp_files_mkdir`, ассеты — `hostingmcp_files_write_base64` или `/files/`.
Целый сайт одним архивом — `hostingmcp_files_import_zip` (`fileBase64` zip).

## Человек + агент

| Кто | Как |
|-----|-----|
| Агент | MCP `hostingmcp_files_*` |
| Человек | браузер `/files/` (Ace-редактор Filebrowser) |

Не правьте один файл одновременно с двух сторон.

## Проверка

После записи — обновить страницу сайта (Ctrl+F5). Отдельно «деплоить» не нужно.
