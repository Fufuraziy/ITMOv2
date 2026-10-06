# VV Collections — правила для агента

Публичная страница **поиска** тематических подборок товаров ВкусВилла («Завтрак с сырниками», «Борщ на большую кастрюлю»): пользователь находит подборку под повод и бюджет и одной кнопкой переносит её в корзину ВкусВилла. Пользователи подборки не создают — каталог собирает куратор. MVP, разработка строго через TDD. Backend — Go + (позже) Postgres, frontend — React + TypeScript.

## Где что лежит

- **Контракт**: `docs/requirements.md` (R1–R5: каталог, поиск, правила, подборка по id, теги). Не меняй его без поручения; нет пункта — спроси.
- **Фичи и идеи**: `docs/features.md`. **Style guide**: `docs/style-guide.md` — прочитай перед изменением кода.
- **Пример теста**: `backend/internal/collections/service_test.go` (`TestService_Search`) — табличный тест через публичный API.
- `catalog/themes.json` — темы и поисковые запросы куратора; `mcp/vv-collections/curate.mjs` собирает из них `backend/catalog/collections.json` через MCP ВкусВилла. Каталог руками не правь — меняй темы и пересобирай.
- `backend/` — Go 1.22+, только стандартная библиотека: `catalog` (встроенный каталог), `internal/collections` (модель, правила, `MemoryStore`, поиск), `internal/httpapi` (HTTP, только чтение), `cmd/api` (запуск).
- `frontend/` — React + Vite, тесты Vitest (`src/ui/App.test.tsx`); дизайн — по skill **frontend-design**, токены в `src/styles.css`.
- `mcp/vv-collections/` — наш MCP-сервер (`search_collections`, `get_collection`, `list_tags`) поверх HTTP API.

## Как проверять

- Один runner: `sh scripts/check.sh [backend|frontend|mcp|skill|hooks]`, без аргумента — всё. Последняя строка — `CHECK PASS` или `CHECK FAIL`.
- После каждой правки (Edit/Write) hook сам запускает нужную область и возвращает результат. `FAIL` от hook значит «исправь код», а не «обойди проверку».
- Новая машина или перенос между Windows и WSL — `bash scripts/setup.sh`: портативные Go и (на Linux) Node 20 в `.tools/`, `npm ci`, полная проверка.
- Запуск сервиса — `bash scripts/dev.sh`: бэкенд `127.0.0.1:8080` + страница `http://localhost:5173`.

## Как работать

- Любое изменение поведения в `backend/` делай через skill **tdd-go**: `RED OK` → минимальная реализация → `GREEN OK` → рефакторинг. Журнал фаз — `docs/evidence/tdd-journal.md`.
- Изменения внешнего вида — через skill **frontend-design**: сначала план и сверка с шаблонными решениями, потом код, потом скриншот и самокритика.
- Новые подборки: тема в `catalog/themes.json` → `node mcp/vv-collections/curate.mjs --dry-run` (проверь выбранные товары и единицы «кг/шт») → без `--dry-run`. Товары и `xml_id` только из MCP ВкусВилла, не выдумывай.
- Подобрать подборку для пользователя — MCP **vv-collections** (`search_collections` → `get_collection`), он отдаёт ссылку на корзину.
- В отчёте показывай фактически выполненные команды и их итог, а не пересказ.

## Нельзя

- Менять `docs/requirements.md`, `scripts/check.sh`, `scripts/hooks/`, `.claude/settings.json`, `opencode.json` без явного поручения.
- Ослаблять проверки ради зелёного результата: `t.Skip`, удаление чужих тестов, правка ожиданий под код.
- Писать файлы за пределами репозитория; инструменты и кэши — только в `.tools/`.
- Делать commit без приёмки человеком.
