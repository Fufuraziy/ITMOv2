# Implementation Plan: Масштабирование подборки по порциям (логика)

**Branch**: `practice_05` (каталог фичи `specs/002-servings-logic`) | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-servings-logic/spec.md`

## Summary

`GET /collections` и `GET /collections/{id}` принимают `servings` ∈ {1, 2, 4} и отдают подборку, пересчитанную на этот множитель, плюс массив `variants` со всеми тремя множителями. Количество масштабируемого товара умножается и округляется до 0.01, немасштабируемого — не меняется; `total_price` округляется один раз от суммы. Ссылки на корзину для ×2 и ×4 куратор создаёт заранее (`curate.mjs`) и кладёт в каталог; бэкенд их только проверяет при старте и отдаёт. Тела ошибок получают машинный `code`.

Технически: каталог (`collections.Collection`) остаётся входной моделью и получает два необязательных поля; ответ API строится отдельным типом через чистую функцию `Scale`. Сигнатуры `Service.Search`/`Service.Get` не меняются, `Query` получает поле `Servings`. Порядок выката — три шага, после каждого `sh scripts/check.sh` зелёный (см. [research.md](research.md), R-7).

## Technical Context

**Language/Version**: Go 1.22+ (бэкенд), Node 20 (скрипт куратора `curate.mjs`)

**Primary Dependencies**: только стандартная библиотека Go; в `curate.mjs` — уже используемый `@modelcontextprotocol/sdk`. Новых зависимостей нет.

**Storage**: встроенный JSON-каталог `backend/catalog/collections.json` (`//go:embed`), в памяти — `MemoryStore`

**Testing**: `go test` через skill **tdd-go** (`RED OK` → `GREEN OK`), `node --test` для `curate.test.js`; всё через `sh scripts/check.sh [backend|mcp]`

**Target Platform**: HTTP-сервис на `127.0.0.1:8080` (Windows/WSL/Linux)

**Project Type**: web-service (read-only HTTP API) + офлайн-скрипт сборки каталога

**Performance Goals**: пересчёт на лету без кэша: каталог 12 подборок × ≤ 20 товаров × 3 множителя — сотни умножений на запрос, ответ в пределах текущих (единицы мс)

**Constraints**: сервис не обращается к ВкусВиллу во время запроса; каталог правится только пересборкой `curate.mjs`; `docs/requirements.md` — только по поручению человека

**Scale/Scope**: 12 подборок, 59 товаров; затрагиваются пакеты `internal/collections`, `internal/httpapi`, `catalog`, скрипт `mcp/vv-collections/curate.mjs`, темы `catalog/themes.json`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | До дизайна | После дизайна |
|---|---|---|---|
| I. TDD через tdd-go | Каждое изменение поведения бэкенда — отдельный цикл RED → GREEN с записью в `docs/evidence/tdd-journal.md`; тесты через `Service`, `Scale` (публичная функция) и HTTP | ✅ | ✅ — циклы перечислены в [quickstart.md](quickstart.md) |
| II. Только stdlib | `math`, `strconv`, `encoding/json`; новых модулей нет | ✅ | ✅ |
| III. Ошибки — значения | Новые нарушения каталога — строки в `*ValidationError` (формат R1); `ParseServings` возвращает `error` как `ParseSort`; сообщения в нижнем регистре; `ctx` первым параметром не меняется | ✅ | ✅ |
| IV. Единый runner | Проверка только через `sh scripts/check.sh`; сам runner не меняется | ✅ | ✅ |
| V. Защищённые файлы | Правка `docs/requirements.md` (R2/R3/R4 + новый R7) нужна, но делается только по поручению человека; текст подготовлен в [contracts/requirements-r7.md](contracts/requirements-r7.md) | ⚠️ ждёт поручения | ⚠️ ждёт поручения — не нарушение, а внешняя зависимость |
| VI. Коммит после приёмки | Плановые артефакты не коммитятся | ✅ | ✅ |

Отдельно о тестовых фикстурах: правило FR-013a делает `cart_urls` обязательным, поэтому существующие фикстуры (`helpers_test.go`, `service_test.go`, `handler_test.go`) должны получить по две ссылки. Это дополнение входных данных под новый контракт, а не правка ожиданий под код: ни одно существующее утверждение не меняется и не удаляется.

Гейт пройден: нарушений, требующих Complexity Tracking, нет.

## Project Structure

### Documentation (this feature)

```text
specs/002-servings-logic/
├── plan.md               # этот файл
├── research.md           # Phase 0: решения R-1…R-8
├── data-model.md         # Phase 1: каталог, ответ, правила, алгоритм
├── quickstart.md         # Phase 1: порядок выката и проверка
├── contracts/
│   ├── http-api.md       # GET /collections, GET /collections/{id}, ошибки
│   ├── catalog-format.md # новые поля collections.json и themes.json
│   └── requirements-r7.md# предлагаемый текст для docs/requirements.md
└── tasks.md              # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── catalog/
│   ├── collections.json        # пересобирается curate.mjs: + cart_urls, + scalable:false
│   └── catalog_test.go         # TestLoad: + все три ссылки уникальны
├── internal/collections/
│   ├── collection.go           # Product.Scalable *bool, Collection.CartURLs
│   ├── servings.go             # НОВЫЙ: Servings, ParseServings, Scale, ScaledCollection, Variant
│   ├── servings_test.go        # НОВЫЙ: TestScale, TestParseServings
│   ├── validate.go             # + ≤10 для масштабируемых, + cart_urls[2|4]
│   ├── search.go               # max_price/sort по цене для q.Servings
│   ├── memory_store.go         # totalPrice переиспользуется Scale
│   └── *_test.go               # фикстуры + новые случаи
├── internal/httpapi/
│   ├── handler.go              # servings, ответ ScaledCollection, code в ошибках
│   └── handler_test.go         # + TestAPI_Servings, + code
catalog/themes.json             # + "scalable": false у отдельных товаров
mcp/vv-collections/
├── curate.mjs                  # scaleQuantity, 3 корзины, cart_urls, scalable
└── curate.test.js              # + тесты scaleQuantity / вариантов
```

**Structure Decision**: существующая раскладка `backend/` + `mcp/vv-collections/`; новый файл только `internal/collections/servings.go` (с тестом) — масштабирование отделено от хранения и поиска. `frontend/` и MCP-сервер (`server.js`) не меняются: zod-схемы сервера отбрасывают неизвестные поля, UI — зона команды 1.

## Complexity Tracking

Нарушений конституции нет — раздел не заполняется.
