# MCP vv-collections

Два назначения.

**1. Сервер для агента** (`server.js`, stdio) — подобрать пользователю готовую подборку и отдать ссылку на корзину ВкусВилла:

| tool | вход | что возвращает | ошибки |
|---|---|---|---|
| `search_collections` | `query?`, `tag?`, `max_price?` (целое > 0), `sort?` (`catalog`/`price_asc`/`price_desc`) | `id — название, сумма, число товаров, теги, корзина` + `structuredContent` | неверные типы и значения — отказ схемы MCP; пусто — подсказка, а не ошибка |
| `get_collection` | `id` | состав «товар: 0,5 кг × 54 ₽», итог, ссылка «Перенести в корзину ВкусВилла» | неизвестный id — ошибка с подсказкой вызвать `search_collections` |
| `list_tags` | — | теги с числом подборок | — |

Бэкенд недоступен — любой инструмент вернёт ошибку с командой запуска. Адрес бэкенда — `VV_API_URL`.

**2. Куратор каталога** (`curate.mjs`) — клиент публичного MCP ВкусВилла: по `catalog/themes.json` ищет товары (`vkusvill_products_search`), создаёт корзины (`vkusvill_cart_link_create`) и пишет `backend/catalog/collections.json`.

```sh
npm ci
npm test                                   # сервер по stdio + функции куратора
node curate.mjs --dry-run                  # какие товары выберутся
node curate.mjs                            # пересобрать каталог
sh ../../scripts/dev-backend.sh & node demo.mjs   # реальные вызовы сервера
```

Подключение: `.mcp.json` (Claude Code) и `opencode.json` (OpenCode).
