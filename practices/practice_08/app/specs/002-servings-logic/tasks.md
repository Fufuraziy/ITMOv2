---

description: "Задачи: масштабирование подборки по порциям (логика)"
---

# Tasks: Масштабирование подборки по порциям (логика)

**Input**: `specs/002-servings-logic/` — [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: обязательны. Конституция (принцип I) требует TDD через skill **tdd-go** для любого изменения поведения в `backend/`. Каждая пара RED → GREEN — это два запуска:

```bash
node .claude/skills/tdd-go/scripts/tdd.mjs red  <TestName> --pkg <pkg>   # ждём «RED OK»
node .claude/skills/tdd-go/scripts/tdd.mjs green <TestName> --pkg <pkg>  # ждём «GREEN OK»
```

Если тест не компилируется («BUILD FAILED»), добавь заглушку с нужной сигнатурой и нулевыми значениями — тест должен падать на утверждении. Скрипт пишет фазы в `docs/evidence/tdd-journal.md`. Для `curate.mjs` (JS) цикл тот же по смыслу, но проверка — `sh scripts/check.sh mcp`.

**Organization**: фазы 1–2 повторяют шаги выката 1–3 из [research.md](research.md) R-7 (каталог с новыми полями должен появиться раньше, чем API начнёт на него опираться); дальше — истории в порядке приоритета: US1 и US3 (P1), US2 (P2), US4 (P3).

**Правила для всех задач**:
- Не менять `docs/requirements.md`, `scripts/check.sh`, `scripts/hooks/`, `.claude/settings.json`, `opencode.json`, `.specify/feature.json`.
- Не удалять и не ослаблять существующие тесты; существующие ожидания не меняются. Разрешено только дополнять фикстуры данными, которых требует новый контракт (T014).
- `backend/catalog/collections.json` руками не правится — только `node mcp/vv-collections/curate.mjs`.
- Сообщения ошибок — в нижнем регистре, без точки; только стандартная библиотека Go.
- Без коммитов до приёмки человеком.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно делать параллельно (другие файлы, нет зависимости от незавершённых задач)
- **[Story]**: история из spec.md (US1–US4)

---

## Phase 1: Setup

**Purpose**: зафиксировать исходное состояние и открытое согласование с командой 1.

- [X] T001 Запустить `sh scripts/check.sh` из корня репозитория и убедиться, что последняя строка `CHECK PASS`; если нет — остановиться и сообщить человеку, фичу не начинать
- [X] T002 [P] Передать команде 1 предложение плана из `specs/002-servings-logic/contracts/http-api.md`: имя массива `variants` и значения `code` — `invalid_query` (400), `collection_not_found` (404), `internal_error` (500); ответ записать в «Открытые вопросы» `specs/002-servings-logic/spec.md`. Блокирует только T031–T032 (значения `code`)

---

## Phase 2: Foundational (шаги выката 1–3)

**Purpose**: каталог хранит пометку «не масштабируется» и ссылки ×2/×4, бэкенд их проверяет; есть тип `Servings`. Без этой фазы ни одна история не работает.

**⚠️ CRITICAL**: истории US1–US4 начинаются только после T018.

### Шаг 1 — бэкенд принимает новые поля каталога (ответ API не меняется)

- [X] T003 RED: в `backend/catalog/catalog_test.go` добавить `TestParse_ServingsFields` — `catalog.Parse` разбирает JSON с подборкой, где есть `"cart_urls": {"2": "https://vkusvill.ru/mobile?basket&share=12", "4": "https://vkusvill.ru/mobile?basket&share=14"}` и у второго товара `"scalable": false`; проверить, что `CartURLs["4"]` дошёл до `collections.Collection`, у первого товара `Scalable == nil`, у второго `*Scalable == false`. Запуск: `tdd.mjs red TestParse_ServingsFields --pkg ./catalog` → `RED OK` (сейчас `DisallowUnknownFields` отвергает поля)
- [X] T004 GREEN: в `backend/internal/collections/collection.go` добавить `Collection.CartURLs map[string]string` с тегом `json:"cart_urls,omitempty"` (комментарий: «ссылки на корзину для ×2 и ×4; ×1 — CartURL») и `Product.Scalable *bool` с тегом `json:"scalable,omitempty"` (комментарий: «nil или true — масштабируется»), метод `func (p Product) IsScalable() bool { return p.Scalable == nil || *p.Scalable }`; в `clone` в `backend/internal/collections/memory_store.go` копировать карту (`maps.Clone`). Запуск: `tdd.mjs green TestParse_ServingsFields --pkg ./catalog` → `GREEN OK`
- [X] T005 RED: в `TestNewMemoryStore_Rules` (`backend/internal/collections/store_test.go`) добавить случаи (формат `want` — как у соседних, `"<id>: <поле>"`): «масштабируемый 10» → `nil`; «масштабируемый 10.01» → `products[0].quantity`; «немасштабируемый 15» (`Scalable: ptr(false)`) → `nil`; «немасштабируемый 41» → только `products[0].quantity`; «cart_urls с ключом 3» → `cart_urls[3]`; «cart_urls[4] с чужим префиксом» → `cart_urls[4]`. Хелпер `ptr` — в `backend/internal/collections/helpers_test.go`. Запуск: `tdd.mjs red TestNewMemoryStore_Rules --pkg ./internal/collections` → `RED OK`
- [X] T006 GREEN: в `backend/internal/collections/validate.go` — константа `scalableQuantityMax float64 = 10` с комментарием «×4 не больше лимита корзины 40»; если количество вне 0.01–40, выдаётся только старое сообщение, иначе для `IsScalable()` и количества > 10 — `add(field+".quantity", "scalable must be %g-%g, got %g", quantityMin, scalableQuantityMax, q)`. Для `cart_urls` обходить ключи по возрастанию (`slices.Sorted(maps.Keys(...))`): ключ не `"2"`/`"4"` → `add("cart_urls["+k+"]", "unknown servings, want 2 or 4")`; значение без префикса `cartURLPrefix` → `add("cart_urls["+k+"]", "must start with %s", cartURLPrefix)`. Отсутствие ключей пока не ошибка. Запуск: `tdd.mjs green TestNewMemoryStore_Rules --pkg ./internal/collections` → `GREEN OK`
- [X] T007 Запустить `sh scripts/check.sh backend` → `CHECK PASS` (текущий каталог проходит: максимальное количество 5)

### Шаг 2 — куратор пересобирает каталог

- [X] T008 Тесты первыми: в `mcp/vv-collections/curate.test.js` добавить — `scaleQuantity({quantity: 0.3}, 4) === 1.2`; `scaleQuantity({quantity: 0.5}, 2) === 1`; `scaleQuantity({quantity: 2, scalable: false}, 4) === 2`; `SERVINGS` равно `[1, 2, 4]`; `cartProducts(products, 2)` возвращает `[{xml_id, q}]` с пересчитанными `q`; `checkItem({quantity: 15})` возвращает текст ошибки «больше 10», а `checkItem({quantity: 15, scalable: false})` и `checkItem({quantity: 10})` — `null`. Запуск `sh scripts/check.sh mcp` → `CHECK FAIL` на этих тестах
- [X] T009 В `mcp/vv-collections/curate.mjs`: экспортировать `SERVINGS = [1, 2, 4]`, `scaleQuantity(p, k)` (= `p.scalable === false ? p.quantity : Math.round(p.quantity * k * 100) / 100`), `cartProducts(products, k)`, `checkItem(item)`; переносить `scalable: false` из `item` темы в товар (только при `false`); при нарушении `checkItem` печатать `✗` и ставить `failed = true`; создавать три корзины через `vkusvill_cart_link_create` — ×1 → `cart_url`, ×2/×4 → `cart_urls: {"2", "4"}`; печатать количества ×1/×2/×4 по каждому товару. Обновить комментарий в шапке файла. Запуск `sh scripts/check.sh mcp` → `CHECK PASS`
- [X] T010 В `catalog/themes.json` добавить `"scalable": false` товарам из [research.md](research.md) R-8: «варенье клубничное», «кофе молотый» (zavtrak-s-syrnikami), «перец черный молотый» (pasta-karbonara), «томатная паста» (borshch), «мед» (syrnaya-tarelka), «чай черный листовой», «варенье малиновое» (chai-s-vypechkoy), «масло подсолнечное» (grechka-s-gribami). Список согласовать с человеком-куратором до пересборки
- [X] T011 Запустить `node mcp/vv-collections/curate.mjs --dry-run` (нужен доступ к `https://mcp001.vkusvill.ru/mcp`); проверить: нет `✗`; у помеченных товаров одинаковое количество в трёх колонках; единицы «кг/шт» правдоподобны; у каждой подборки три ссылки `mobile?basket&share=`. Вывод приложить к отчёту
- [X] T012 Запустить `node mcp/vv-collections/curate.mjs` (без `--dry-run`) → перезаписан `backend/catalog/collections.json` (у подборок есть `cart_urls`, у помеченных товаров `"scalable": false`; цены и `updated_at` обновятся — это ожидаемо). Затем `sh scripts/check.sh` → `CHECK PASS` (`TestLoad` принимает новый каталог)

### Шаг 3 — ссылки обязательны; тип Servings

- [X] T013 [P] Обновить тест данных `TestLoad` в `backend/catalog/catalog_test.go`: у каждой подборки есть `CartURLs["2"]` и `CartURLs["4"]`, и все ссылки каталога (`cart_url` и обе из `cart_urls`) уникальны — расширить существующую проверку `carts`, не удаляя её. Это проверка данных, а не поведения: цикл tdd-go не нужен, запуск `sh scripts/check.sh backend` → `CHECK PASS`
- [X] T014 Дополнить фикстуры ссылками ×2/×4 (по требованию FR-013a; существующие утверждения не трогать): `breakfast()` и `soup()` в `backend/internal/collections/helpers_test.go`, `pasta()` в `backend/internal/collections/service_test.go`, `catalog()` в `backend/internal/httpapi/handler_test.go` — `CartURLs: map[string]string{"2": "https://vkusvill.ru/mobile?basket&share=<id>2", "4": "...<id>4"}`, все значения уникальны. Запуск `sh scripts/check.sh backend` → `CHECK PASS`
- [X] T015 RED: в `TestNewMemoryStore_Rules` (`backend/internal/collections/store_test.go`) добавить «нет cart_urls[2]» (удалить ключ) → `cart_urls[2]` и «нет cart_urls» (`nil`) → `cart_urls[2]`, `cart_urls[4]`. Запуск: `tdd.mjs red TestNewMemoryStore_Rules --pkg ./internal/collections` → `RED OK`
- [X] T016 GREEN: в `backend/internal/collections/validate.go` для каждого обязательного ключа из `"2"`, `"4"`, которого нет в `CartURLs`, — `add("cart_urls["+k+"]", "missing")`; сообщения в порядке возрастания ключей вместе с проверками T006. Запуск: `tdd.mjs green TestNewMemoryStore_Rules --pkg ./internal/collections` → `GREEN OK`
- [X] T017 RED: создать `backend/internal/collections/servings_test.go` с `TestParseServings` (табличный, как `TestParseSort`): `""` → 1; `"1"`, `"2"`, `"4"` → 1, 2, 4; ошибка для `"0"`, `"3"`, `"-2"`, `"2.0"`, `"02"`, `" 2"`, `"4 "`, `"+2"`, `"x2"`; текст ошибки для `"3"` — ровно `servings must be one of 1, 2, 4, got "3"`. Заглушка в `backend/internal/collections/servings.go`: `type Servings int`, `func ParseServings(s string) (Servings, error) { return 0, nil }`. Запуск: `tdd.mjs red TestParseServings --pkg ./internal/collections` → `RED OK`
- [X] T018 GREEN: в `backend/internal/collections/servings.go` — doc-комментарий типа `Servings`: «множитель порций (R7): 1, 2 или 4»; константы `Servings1`, `Servings2`, `Servings4`; `var AllServings = []Servings{1, 2, 4}`; `ParseServings` сравнивает строку точно с `"1"`, `"2"`, `"4"`, пустая → 1, иначе `fmt.Errorf("servings must be one of 1, 2, 4, got %q", s)`; метод `(s Servings) orDefault() Servings` — 0 → 1. Запуск: `tdd.mjs green TestParseServings --pkg ./internal/collections` → `GREEN OK`

**Checkpoint**: каталог пересобран, ссылки и пометки проверяются при старте, `sh scripts/check.sh` → `CHECK PASS`.

---

## Phase 3: User Story 1 — подборка на нужное число порций (P1) 🎯 MVP

**Goal**: `GET /collections/{id}?servings=k` и `GET /collections?servings=k` отдают пересчитанные количества, `total_price`, `base_quantity`, `scalable`, `servings` и три `variants`.

**Independent Test**: `TestScale` и `TestAPI_Servings` зелёные; `curl "http://127.0.0.1:8080/collections/zavtrak-s-syrnikami?servings=4"` — сырники и сметана 4, кофе и варенье 1, три варианта.

- [X] T019 [US1] RED: в `backend/internal/collections/servings_test.go` добавить `TestScale` (таблица по `servings` 1/2/4) на собственной фикстуре: тыква `Quantity 2` шт 136 ₽, лук `0.5` кг 54 ₽, сливки `1` шт 120 ₽ (масштабируемые), кофе `1` шт 490 ₽ `Scalable: ptr(false)`, морковь `0.3` кг 50 ₽. Проверить: ×2 → тыква 4, лук 1, сливки 2, кофе 1; ×4 → 8, 2, 4, 1, морковь ровно `1.2` и `json.Marshal` даёт `1.2`, целые — без `.0`; `BaseQuantity` = количество каталога; `Scalable` false только у кофе; `Servings` = k; `TotalPrice` = `math.Round(Σ price × quantity)`; `Variants` — ровно 3, `Multiplier` 1, 2, 4 по порядку, `Quantities` с ключами `strconv.FormatInt(xml_id, 10)`, `Available == true`, `Reason == ""`; вариант с `Multiplier == k` совпадает с `TotalPrice` и количествами подборки; `Scale(c, 1)` совпадает со старыми полями (`TotalPrice` из `MemoryStore`). Отдельный случай округления: товар 50.2 ₽ × 2 (сумма 100.4) → ×1 `TotalPrice` 100, ×2 → 201. Заглушки типов и `func Scale(c Collection, s Servings) ScaledCollection { return ScaledCollection{} }`. Запуск: `tdd.mjs red TestScale --pkg ./internal/collections` → `RED OK`
- [X] T020 [US1] GREEN: в `backend/internal/collections/servings.go` — типы по [data-model.md](data-model.md): `ScaledCollection` (`id`, `title`, `description`, `tags`, `servings`, `cart_url`, `total_price`, `products`, `variants`), `ScaledProduct` (поля `Product` + `quantity`, `base_quantity`, `scalable bool`), `Variant` (`multiplier`, `total_price`, `quantities map[string]float64`, `cart_url`, `available`, `reason` с `omitempty`); `scaleQuantity(p, k)` = `p.Quantity`, если не `IsScalable()`, иначе `math.Round(p.Quantity*float64(k)*100) / 100`; `total_price` — через существующий `totalPrice` из `backend/internal/collections/memory_store.go` по пересчитанным количествам (одно округление); `Scale` использует `s.orDefault()`. Пока `cart_url` подборки и вариантов = `c.CartURL` — правильные ссылки делает US3 (T024). Запуск: `tdd.mjs green TestScale --pkg ./internal/collections` → `GREEN OK`
- [X] T021 [US1] RED: в `backend/internal/httpapi/handler_test.go` добавить `TestAPI_Servings` (декодировать в `collections.ScaledCollection`): `GET /collections/zavtrak?servings=2` → 200, `servings` 2, количества 2 и 2, `base_quantity` 1, `scalable` true, `total_price` 808, три `variants`; `GET /collections/zavtrak` и `?servings=` → `servings` 1, `total_price` 404 и `cart_url` `https://vkusvill.ru/mobile?basket&share=1` как до фичи; `?servings=2&servings=4` → `servings` 2; `GET /collections?servings=4` → у каждой подборки `servings` 4 и `variants` длины 3. Запуск: `tdd.mjs red TestAPI_Servings --pkg ./internal/httpapi` → `RED OK`
- [X] T022 [US1] GREEN: в `backend/internal/collections/search.go` добавить `Query.Servings Servings` (комментарий «0 — как 1»); в `backend/internal/httpapi/handler.go` — `parseQuery` читает `servings` через `collections.ParseServings` (ошибка — тот же путь `400 invalid query: …`); `searchResponse.Collections` становится `[]collections.ScaledCollection`, результаты `Search` превращаются через `collections.Scale(c, q.Servings)`; в `get` сначала разобрать `servings` (неверный → `400` до вызова `Get`), потом `Get` и `Scale`. Обновить комментарий пакета (R7). Запуск: `tdd.mjs green TestAPI_Servings --pkg ./internal/httpapi` → `GREEN OK`

**Checkpoint**: количества, цены и варианты верны; ссылки при ×2/×4 пока ×1 — не выпускать без US3.

---

## Phase 4: User Story 3 — корзина соответствует выбранным порциям (P1)

**Goal**: `cart_url` подборки и каждого варианта — ссылка куратора для своего множителя.

**Independent Test**: `TestScale_CartURL` зелёный; ручная сверка трёх подборок × трёх множителей (SC-006).

- [X] T023 [US3] RED: в `backend/internal/collections/servings_test.go` добавить `TestScale_CartURL`: `Scale(c, 1).CartURL == c.CartURL`, `Scale(c, 2).CartURL == c.CartURLs["2"]`, `Scale(c, 4).CartURL == c.CartURLs["4"]`; у `Variants[i]` `CartURL` для своего `Multiplier`; вариант с `Multiplier == servings` совпадает с `CartURL` подборки. Запуск: `tdd.mjs red TestScale_CartURL --pkg ./internal/collections` → `RED OK`
- [X] T024 [US3] GREEN: в `backend/internal/collections/servings.go` — `cartURL(c Collection, k Servings) string`: `k == 1` → `c.CartURL`, иначе `c.CartURLs[strconv.Itoa(int(k))]`; использовать в `Scale` для подборки и вариантов. Запуск: `tdd.mjs green TestScale_CartURL --pkg ./internal/collections` → `GREEN OK`
- [X] T025 [US3] Регрессия HTTP: в `TestAPI_Servings` (`backend/internal/httpapi/handler_test.go`) добавить утверждение `GET /collections/zavtrak?servings=4` → `cart_url` = ссылка ×4 из фикстуры T014 и равна `cart_url` варианта 4. Запуск `sh scripts/check.sh backend` → `CHECK PASS`
- [X] T026 [US3] Ручная проверка SC-006: `bash scripts/dev.sh`; для `zavtrak-s-syrnikami`, `tykvennyi-krem-sup`, `borshch` и `servings` 1, 2, 4 открыть `cart_url` из `curl "http://127.0.0.1:8080/collections/<id>?servings=<k>"` и сверить корзину ВкусВилла с `products[].quantity`. Результат (9 строк: подборка, k, совпало/нет) записать в `docs/evidence/servings-carts.md`

**Checkpoint**: US1 + US3 — минимальный выпускаемый объём (MVP).

---

## Phase 5: User Story 2 — поиск с учётом порций и бюджета (P2)

**Goal**: `max_price` и сортировка по цене в `GET /collections` работают по `total_price` для `servings`.

**Independent Test**: `TestService_SearchServings` зелёный; `curl "http://127.0.0.1:8080/collections?servings=4&max_price=1000&sort=price_asc"` — все `total_price` ≤ 1000 по возрастанию.

- [X] T027 [US2] RED: в `backend/internal/collections/service_test.go` добавить `TestService_SearchServings` на своей фикстуре: подборка A — один масштабируемый товар 500 ₽; подборка B — масштабируемый 200 ₽ и немасштабируемый 400 ₽ (`Scalable: ptr(false)`); обе с `CartURLs`. Случаи: `{Sort: price_asc}` → A, B; `{Servings: 2, Sort: price_asc}` → B (800), A (1000); `{Servings: 2, Sort: price_desc}` → A, B; `{Servings: 2, MaxPrice: 900}` → B; `{MaxPrice: 500}` → A; равные цены — порядок каталога. Запуск: `tdd.mjs red TestService_SearchServings --pkg ./internal/collections` → `RED OK`
- [X] T028 [US2] GREEN: в `backend/internal/collections/search.go` фильтр `max_price` и обе сортировки используют `priceFor(c, q.Servings)` (= `totalPrice` по `scaleQuantity` для `q.Servings.orDefault()`) вместо `c.TotalPrice`; сортировка остаётся устойчивой. Запуск: `tdd.mjs green TestService_SearchServings --pkg ./internal/collections` → `GREEN OK`
- [X] T029 [US2] Регрессия HTTP: в таблицу `TestAPI_Search` (`backend/internal/httpapi/handler_test.go`) добавить строку `servings=2&max_price=800` → только `sup` (272 ₽ при ×2) и строку `servings=2&sort=price_desc` → `zavtrak`, `sup`. Запуск `sh scripts/check.sh backend` → `CHECK PASS`

**Checkpoint**: US1–US3 работают вместе; поиск без `servings` не изменился (существующие случаи `TestService_Search` зелёные).

---

## Phase 6: User Story 4 — понятная ошибка при неверном числе порций (P3)

**Goal**: неверный `servings` → `400` в формате R2; у всех ошибок есть `code`.

**Independent Test**: `TestAPI_ErrorCodes` зелёный; `curl -i "http://127.0.0.1:8080/collections/net?servings=3"` → `400` с `"code":"invalid_query"`.

- [X] T030 [P] [US4] Регрессия: в `TestAPI_SearchBadQuery` (`backend/internal/httpapi/handler_test.go`) добавить строки `servings=0`, `servings=3`, `servings=-2`, `servings=2.0`, `servings=02`, `servings=%202`, `servings=x2` → `400`, `error` с префиксом `invalid query: `. Поведение уже есть после T022, поэтому это не цикл RED — запуск `sh scripts/check.sh backend` → `CHECK PASS`
- [X] T031 [US4] RED: добавить `TestAPI_ErrorCodes` в `backend/internal/httpapi/handler_test.go` (после T002; значения `code` — из ответа команды 1, по умолчанию по [contracts/http-api.md](contracts/http-api.md)): `GET /collections?max_price=0` и `?servings=3` → `code` `invalid_query`; `GET /collections/net?servings=abc` → `400` и `invalid_query` (servings проверяется раньше id); `GET /collections/net?servings=2` → `404` и `collection_not_found`; ошибка хранилища → `500` и `internal_error` (тестовый `failingStore`, реализующий `collections.Store` и возвращающий ошибку из `List`/`Get`). Запуск: `tdd.mjs red TestAPI_ErrorCodes --pkg ./internal/httpapi` → `RED OK`
- [X] T032 [US4] GREEN: в `backend/internal/httpapi/handler.go` — `errorBody` получает `Code string` с тегом `json:"code"`; константы `codeInvalidQuery = "invalid_query"`, `codeNotFound = "collection_not_found"`, `codeInternal = "internal_error"`; все `writeJSON` с ошибкой передают код. Тексты `error` не меняются. Запуск: `tdd.mjs green TestAPI_ErrorCodes --pkg ./internal/httpapi` → `GREEN OK`

**Checkpoint**: все истории готовы.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 Полная проверка: `sh scripts/check.sh` → `CHECK PASS` (backend, frontend, mcp, skill, hooks); MCP-сервер и фронтенд проходят без изменений
- [X] T034 Сквозная проверка по [quickstart.md](quickstart.md), раздел «Сквозная проверка на живом сервисе»: `bash scripts/dev.sh` и четыре `curl`; в отчёт — команды и фактические ответы
- [X] T035 [P] Проверить `docs/evidence/tdd-journal.md`: для T003/T004, T005/T006, T015/T016, T017/T018, T019/T020, T021/T022, T023/T024, T027/T028, T031/T032 есть пары `RED OK` → `GREEN OK`
- [X] T036 [P] В `docs/features.md` перенести «Порции ×2 / ×4» из «Можно добавить» в «Сделано» (где: `servings`, `variants`, `cart_urls`; как: ссылки куратора на каждый множитель)
- [X] T037 Только по явному поручению человека: внести в `docs/requirements.md` текст из `specs/002-servings-logic/contracts/requirements-r7.md` (R2, R3, R4, R7, «Прочее»). Без поручения — пропустить и указать в отчёте как открытое
- [X] T038 Отчёт человеку: выполненные команды и их итог, вывод `--dry-run` (T011), `docs/evidence/servings-carts.md` (T026); коммит — только после приёмки

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T002)**: сразу. T002 идёт параллельно со всем, кроме T031–T032.
- **Foundational (T003–T018)**: строго по порядку шагов выката: шаг 1 (T003–T007) → шаг 2 (T008–T012) → шаг 3 (T013–T018). T013 зависит от T012 (новый каталог), T015 — от T014 (фикстуры со ссылками).
- **US1 (T019–T022)**: после T018.
- **US3 (T023–T026)**: после T020 (функция `Scale`); T025 — после T022; T026 — после T024 и T012.
- **US2 (T027–T028)**: после T020 (`scaleQuantity`); T029 — после T022 и T028.
- **US4 (T030–T032)**: T030 — после T022; T031 — после T002 и T022.
- **Polish (T033–T038)**: после всех историй; T037 — только по поручению.

### User Story Dependencies

- **US1 (P1)**: база для остальных — вводит `Scale` и `servings` в HTTP.
- **US3 (P1)**: дополняет `Scale` ссылками; выпускать US1 без US3 нельзя (при ×2/×4 была бы ссылка ×1).
- **US2 (P2)**: зависит только от `scaleQuantity` (US1); с US3 и US4 не пересекается по файлам, кроме `handler_test.go` (T029).
- **US4 (P3)**: зависит от разбора `servings` в обработчике (US1) и от согласования кодов (T002).

### Within Each User Story

- RED (`RED OK`) → GREEN (`GREEN OK`) → рефакторинг при необходимости, после него снова `sh scripts/check.sh backend`.
- Сначала `internal/collections` (сервис), потом `internal/httpapi` (HTTP).

### Parallel Opportunities

- T002 — параллельно с фазой 2.
- T013 и T014 — разные файлы, после T012.
- После T020: US3 (T023–T024, `servings.go`/`servings_test.go`) и US2 (T027–T028, `search.go`/`service_test.go`) — разные файлы; но `servings_test.go` в T023 и `service_test.go` в T027 — разные, параллельно можно.
- T030 — параллельно с T031 только если правки в `handler_test.go` делают последовательно в одной сессии (один файл); с US2/US3 не конфликтует.
- T035 и T036 — параллельно.

---

## Parallel Example: после T022

```text
Сессия A (US3): T023 → T024 → T025   # servings.go, servings_test.go, затем handler_test.go
Сессия B (US2): T027 → T028          # search.go, service_test.go
Затем по очереди: T029 (handler_test.go), T030–T032 (handler.go, handler_test.go)
```

`handler_test.go` правят T025, T029, T030, T031 — их выполнять последовательно.

---

## Implementation Strategy

### MVP (US1 + US3)

1. Phase 1 → Phase 2 (каталог пересобран, `CHECK PASS`).
2. US1 (T019–T022) → US3 (T023–T026).
3. **Стоп и проверка**: `TestScale`, `TestScale_CartURL`, `TestAPI_Servings` зелёные; ручная сверка корзин (T026).
4. Это уже полезная фича для UI: варианты, количества, цены, ссылки. Решение 6A — выпускать вместе с пересборкой каталога; это выполнено в фазе 2.

### Incremental Delivery

1. MVP (US1 + US3) → можно отдавать команде 1.
2. + US2 — бюджет и сортировка с порциями (нужно MCP и будущим клиентам; UI команды 1 `servings` в поиск не передаёт).
3. + US4 — `code` в ошибках (UI различает ошибки по нему, FR-019 спеки 001).
4. Polish.

### Parallel Team Strategy

Один бэкенд-разработчик проходит фазы по порядку. Если людей двое: после T022 один берёт US3, другой US2 (разные файлы), US4 — после согласования `code`.

---

## Notes

- Всего 38 задач: Setup 2, Foundational 16, US1 4, US3 4, US2 3, US4 3, Polish 6.
- Покрытие требований: FR-001–FR-004 — T017–T018, T021–T022, T030; FR-005/005a/007 — T003–T004, T019–T020; FR-006 — T005–T006; FR-008–FR-009 — T019–T020; FR-010 — T027–T029; FR-011/011a–c — T019–T022; FR-012/013/013a — T008–T016, T023–T026; FR-014–FR-015 — T006, T021, T033; FR-016 — T031–T032.
- Проверка данных (T013), регрессии на уже реализованное поведение (T025, T029, T030) не проходят через `tdd.mjs red` — тест на них сразу зелёный, и это ожидаемо.
- После каждой правки hook сам запускает нужную область проверок; `FAIL` от hook — исправлять код, а не проверку.
