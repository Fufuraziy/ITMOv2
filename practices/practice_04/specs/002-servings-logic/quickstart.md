# Quickstart: проверка порций

Порядок выката и решения — [research.md](research.md) R-7; поля и правила — [data-model.md](data-model.md); контракты — [contracts/](contracts/). Здесь только как убедиться, что каждый шаг работает.

## Перед началом

```bash
bash scripts/setup.sh          # если машина новая
sh scripts/check.sh            # последняя строка: CHECK PASS
```

Каждое изменение поведения бэкенда — цикл skill **tdd-go**:

```bash
node .claude/skills/tdd-go/scripts/tdd.mjs red TestИмя --pkg ./internal/collections   # ждём RED OK
node .claude/skills/tdd-go/scripts/tdd.mjs green TestИмя --pkg ./internal/collections # ждём GREEN OK
```

## Шаг 1 — бэкенд принимает новые поля каталога

Циклы TDD (пакет → что падает в RED):

| пакет | тест | проверяет |
|---|---|---|
| `./catalog` | `TestParse_ServingsFields` (новый) | каталог с `cart_urls` и `scalable: false` разбирается, поля доходят до `Collection`/`Product` |
| `./internal/collections` | `TestNewMemoryStore_Rules` / новые случаи | масштабируемый 10 — ок, 10.01 и 15 — `scalable must be 0.01-10`; немасштабируемый 15 — ок; `cart_urls[3]` — unknown; неверный префикс |

Итог: `sh scripts/check.sh backend` → `CHECK PASS`; текущий каталог проходит (максимум 5), ответ API не изменился.

## Шаг 2 — куратор пересобирает каталог

```bash
sh scripts/check.sh mcp                              # тесты scaleQuantity в curate.test.js
node mcp/vv-collections/curate.mjs --dry-run         # проверить ×1/×2/×4 и пометки «не масштабируется»
node mcp/vv-collections/curate.mjs                   # записать backend/catalog/collections.json
sh scripts/check.sh                                  # CHECK PASS: TestLoad принимает новый каталог
```

Ожидаемо в `--dry-run`: у товаров из [research.md](research.md) R-8 одинаковое количество в трёх колонках; ни одного масштабируемого товара больше 10; три ссылки `mobile?basket&share=` на подборку.

Ручная проверка SC-006: открыть ×1/×2/×4 у трёх подборок (например, `zavtrak-s-syrnikami`, `tykvennyi-krem-sup`, `borshch`) и сверить корзину с выводом `--dry-run`.

## Шаг 3 — бэкенд требует ссылки и отдаёт порции

| пакет | тест | проверяет |
|---|---|---|
| `./internal/collections` | `TestNewMemoryStore_Rules` / новый случай | нет `cart_urls[2]` → `cart_urls[2]: missing` (фикстуры получают ссылки) |
| `./catalog` | `TestLoad` / новое утверждение | все ссылки ×1/×2/×4 каталога уникальны |
| `./internal/collections` | `TestParseServings` | `""`→1, `1`/`2`/`4`; `0`, `3`, `-2`, `2.0`, `02`, ` 2`, `x2` — ошибка |
| `./internal/collections` | `TestScale` | US1.1–1.5: 4/1/2 при ×2; 0.3×4 = 1.2; немасштабируемые не меняются; `base_quantity`; три варианта; вариант `servings` = подборка; ×1 = как до фичи; округление 100.4/200.8 |
| `./internal/collections` | `TestService_Search` / новые случаи | `max_price` и `price_asc`/`price_desc` по цене для `Servings` |
| `./internal/httpapi` | `TestAPI_Servings` | `servings=2` в поиске и по id; `servings=3` → 400 `invalid_query`; неверный `servings` + неизвестный id → 400; верный + неизвестный → 404 |
| `./internal/httpapi` | `TestAPI_ErrorCodes` | `code` у 400/404/500 |

Итог: `sh scripts/check.sh` → `CHECK PASS`.

## Сквозная проверка на живом сервисе

```bash
bash scripts/dev.sh
```

В другом терминале:

```bash
curl -s "http://127.0.0.1:8080/collections/zavtrak-s-syrnikami?servings=4"
```

Ожидаемо: `"servings":4`; сырники и сметана — `quantity` 4, `base_quantity` 1; кофе и варенье — `quantity` 1, `scalable` false; три `variants`; `cart_url` равен `cart_url` варианта 4.

```bash
curl -s "http://127.0.0.1:8080/collections/zavtrak-s-syrnikami"
```

Ожидаемо: старые поля совпадают с ответом до фичи (SC-003), `"servings":1`.

```bash
curl -s -i "http://127.0.0.1:8080/collections/net?servings=3"
```

Ожидаемо: `400`, `{"error":"invalid query: servings must be one of 1, 2, 4, got \"3\"","code":"invalid_query"}`.

```bash
curl -s "http://127.0.0.1:8080/collections?servings=4&max_price=1000&sort=price_asc"
```

Ожидаемо: у каждой подборки `total_price` ≤ 1000 и по возрастанию (SC-005).

## Вне этого плана

- Правка `docs/requirements.md` по [contracts/requirements-r7.md](contracts/requirements-r7.md) — только по поручению человека.
- UI (команда 1) и параметр порций в MCP-инструментах.
