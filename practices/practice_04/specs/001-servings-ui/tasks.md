---
description: "Tasks: переключатель порций ×1/×2/×4 (UI, команда 1)"
---

# Tasks: Переключатель порций ×1 / ×2 / ×4 (UI)

**Input**: `specs/001-servings-ui/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Prerequisites**: план и спека приняты; контракт API — `specs/002-servings-logic/contracts/http-api.md` (`variants`, коды `invalid_query`, `collection_not_found`, `internal_error`)

**Tests**: да. AGENTS.md: «MVP, разработка строго через TDD». Каждая тестовая задача сначала запускается и MUST упасть на утверждении (`sh scripts/check.sh frontend` → `CHECK FAIL` из-за `expect`, а не из-за компиляции), потом пишется код до `CHECK PASS`. Существующие тесты не ослабляются и не правятся под код.

**Organization**: по историям спеки. US3 снята (решения 5A, 6A) — фазы для неё нет.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (другой файл, нет зависимости от незавершённых задач)
- **[Story]**: US1, US2, US4 из spec.md
- Пути — от корня репозитория; меняется только `frontend/src/`

---

## Phase 1: Setup

**Purpose**: зелёная точка отсчёта и общие тестовые данные

- [X] T001 Запустить `sh scripts/check.sh frontend` и убедиться, что последняя строка `CHECK PASS` до любых правок (`frontend/`)
- [X] T002 Создать `frontend/src/ui/fixtures.ts` и экспортировать из него фикстуры с вариантами (`dinner`, `soup`) и функцию `withVariants(c, patch)` для копий с изменёнными вариантами; существующую `breakfast` в `App.test.tsx` не трогать: `dinner` — `id: 'uzhin-na-kompaniyu'`, `title: 'Ужин на компанию'`, `tags: ['ужин']`, `total_price: 999`, `cart_url: 'https://vkusvill.ru/?share_basket=1001'`, товары `{xml_id: 114976, name: 'Сырники классические жареные', quantity: 1, base_quantity: 1, scalable: true, unit: 'шт', price: 306}`, `{xml_id: 3001, name: 'Лук репчатый', quantity: 0.5, base_quantity: 0.5, scalable: true, unit: 'кг', price: 54}`, `{xml_id: 5005, name: 'Кофе молотый', quantity: 1, base_quantity: 1, scalable: false, unit: 'шт', price: 666}` (у каждого товара также `rating: 4.8`, `url: 'https://vkusvill.ru/goods/item-<xml_id>/'`, `image: 'https://img.vkusvill.ru/<xml_id>.webp'`), `variants`: `{multiplier: 1, total_price: 999, quantities: {'114976': 1, '3001': 0.5, '5005': 1}, cart_url: '…=1001', available: true}`, `{multiplier: 2, total_price: 1332, quantities: {'114976': 2, '3001': 1, '5005': 1}, cart_url: '…=1002', available: true}`, `{multiplier: 4, total_price: 1998, quantities: {'114976': 4, '3001': 2, '5005': 1}, cart_url: '…=1004', available: true}`; и `soup` — копия `dinner` с `id: 'sup-na-nedelyu'`, `title: 'Суп на неделю'` и ссылками `…=2001/2002/2004`

---

## Phase 2: Foundational (блокирует все истории)

**Purpose**: типы, разбор `variants` с откатом к старой карточке, ошибки API с `code`

- [X] T003 Расширить типы в `frontend/src/api.ts` (data-model.md): `type Multiplier = 1 | 2 | 4`; `type Variant = { multiplier: Multiplier; total_price: number; quantities: Record<string, number>; cart_url: string; available: boolean; reason?: string }`; в `Product` — `scalable?: boolean`, `base_quantity?: number`; в `Collection` — `variants?: Variant[]`, `servings?: Multiplier`. `toSearchParams` не меняется и `servings` не добавляет (FR-018). Создать заглушки, чтобы красная фаза падала на утверждении, а не на импорте: новый `frontend/src/servings.ts` с `export function readVariants(c: Collection): Variant[] | null { return null }` и в `frontend/src/api.ts` `export class ApiError extends Error { status = 0; code?: string }` (`getJSON` его пока не бросает). `sh scripts/check.sh frontend` → `CHECK PASS`
- [X] T004 [P] Написать падающие тесты `readVariants(c)` в новом `frontend/src/servings.test.ts` (research R-4); фикстуры — из `frontend/src/ui/fixtures.ts`: для `dinner` возвращает три варианта в порядке `multiplier` 1, 2, 4 (в том числе если в ответе порядок другой); возвращает `null`, если `variants` нет; если элементов не ровно три; если набор `multiplier` не {1, 2, 4}; если у варианта `cart_url` не непустая строка; если `total_price` не число; если в `quantities` нет ключа `String(xml_id)` для какого-то товара из `products` (зависит от T003)
- [X] T005 Заменить заглушку `readVariants` в `frontend/src/servings.ts` реализацией по правилам T004; тесты T004 зелёные (зависит от T003, T004)
- [X] T006 [P] Написать падающие тесты в новом `frontend/src/api.test.ts` (research R-7, FR-019; зависит от T003): при ответе `400` с телом `{"error": "invalid query: …", "code": "invalid_query"}` `searchCollections` отклоняется с `ApiError`, у которого `status === 400` и `code === 'invalid_query'`; при `500` с `{"error": "internal error", "code": "internal_error"}` — `code === 'internal_error'`; при теле не-JSON — `code === undefined`, `status` из ответа
- [X] T007 Заполнить `ApiError` в `frontend/src/api.ts` (`status` — HTTP-код ответа, `code` — из тела) и бросать его из `getJSON`; тело ошибки читать через `res.json()` в `try/catch`. В `frontend/src/ui/App.tsx` не разбирать текст ошибки; любая ошибка поиска по-прежнему показывает «Каталог не отвечает. Обновите страницу через минуту.» (зависит от T006)
- [X] T008 Запустить `sh scripts/check.sh frontend`: `CHECK PASS`, все прежние тесты `App.test.tsx` зелёные без правок ожиданий

**Checkpoint**: фундамент готов; на ответе без `variants` страница работает как раньше

---

## Phase 3: User Story 1 — Увидеть подборку на ×2 / ×4 (Priority: P1) 🎯 MVP

**Goal**: в карточке переключатель «Порции» ×1/×2/×4; итог и состав берутся из выбранного варианта без запросов.

**Independent Test**: выбрать ×2 и ×4 в карточке `dinner` — итог и состав меняются; другие карточки, адрес и число вызовов `fetch` не меняются.

### Tests for User Story 1 (сначала, должны упасть)

- [X] T009 [US1] Тест в `frontend/src/ui/App.test.tsx` (US1.1, US1.6, FR-001, FR-003, FR-004): в карточке `dinner` есть `group` с именем «Порции» и три `radio` «×1», «×2», «×4», отмечен «×1», итог «≈ 999 ₽». После клика по «×2» отмечен «×2», итог «≈ 1 332 ₽ · ×2»; в раскрытом составе строки «2 шт · было 1 шт × 306 ₽» (сырники), «1 кг · было 0,5 кг × 54 ₽» (лук), «1 шт × 666 ₽» (кофе, без «было»); число вызовов `fetch` до и после клика одинаковое; `window.location.search` не изменился
- [X] T010 [US1] Тест в `frontend/src/ui/App.test.tsx` (US1.2): после «×2» → «×1» итог снова «≈ 999 ₽», в составе «1 шт × 306 ₽» и «0,5 кг × 54 ₽», нигде нет «было»
- [X] T011 [US1] Тест в `frontend/src/ui/App.test.tsx` (US1.3, FR-002): в выдаче `dinner` и `soup`; «×4» в `dinner` не меняет выбор в `soup` — там отмечен «×1» и итог «≈ 999 ₽»
- [X] T012 [US1] Тест в `frontend/src/ui/App.test.tsx` (US1.4, FR-011, FR-018): в `dinner` выбран «×2»; ввод запроса, на который мок отвечает пустой выдачей, затем запрос, на который мок снова отдаёт `dinner` — в карточке отмечен «×2». Ни в одном запросе `/collections` (через `searches()`) нет параметра `servings`
- [X] T013 [US1] Тест в `frontend/src/ui/App.test.tsx` (FR-014, research R-3): элемент с итогом карточки имеет `aria-live="polite"` и `aria-atomic="true"`
- [X] T014 [US1] Тест в `frontend/src/ui/App.test.tsx` (FR-016, research R-8): при бюджете «до 1 000 ₽» и «×1» у `dinner` нет текста «больше бюджета»; после «×2» он есть; при бюджете «любой» и «×4» его нет

### Implementation for User Story 1

- [X] T015 [US1] В `frontend/src/ui/App.tsx` поднять выбор множителя в `App`: `useState<Record<string, Multiplier>>({})`, нет ключа — ×1; передавать в `Shelf` `multiplier` и `onSelect(m)`; в адрес и `localStorage` не писать (research R-1, FR-011)
- [X] T016 [US1] В `frontend/src/ui/App.tsx` добавить переключатель в блок `.shelf__buy` перед итогом, только если `readVariants(c) !== null`: `<fieldset className="servings">` с `<legend>Порции</legend>` и тремя нативными `<input type="radio">` (общий `name` из `useId()`, подписи «×1», «×2», «×4», `checked` по `multiplier`) (research R-2, contracts/ui-card.md)
- [X] T017 [US1] В `frontend/src/ui/App.tsx` (`Shelf`) считать активный вариант: итог `active.total_price`, текст «≈ X ₽» при ×1 и «≈ X ₽ · ×N» при ×2/×4 в `<span className="shelf__total" aria-live="polite" aria-atomic="true">`; количество в строке состава — `active.quantities[String(p.xml_id)]`, «· было {base_quantity} {unit}» — только при `multiplier > 1` и `p.scalable === true`; формат — существующая `qty()`. Без вариантов — `c.total_price` и `p.quantity`, как сейчас (research R-5)
- [X] T018 [US1] В `frontend/src/ui/App.tsx` передать `filters.maxPrice` в `Shelf` и показывать `<span className="shelf__over-budget">больше бюджета</span>` рядом с итогом, если `maxPrice > 0 && total > maxPrice` (research R-8)
- [X] T019 [P] [US1] Оформить переключатель и пометку в `frontend/src/styles.css` через skill frontend-design (план → сверка с шаблонными решениями → код): `.servings` — сегменты на токенах `--ink`/`--shelf`/`--paper`, выбранный как `.chip[aria-pressed='true']`, видимый `:focus-visible` на радиокнопке, `legend` «Порции» в стиле `.sort`; `.shelf__over-budget` — мелкий текст `--ink-soft`; при ширине до 480 px переключатель отдельной строкой в `.shelf__buy`
  - Отступление после скриншота: переключатель стоит отдельной строкой при любой ширине, итог — строкой ниже (`.servings, .servings + .shelf__total { flex-basis: 100% }`), правило «до 480 px» не понадобилось: иначе длинный итог ×4 переносился и сдвигал кнопку корзины при переключении.
- [X] T020 [US1] Запустить `sh scripts/check.sh frontend`: T009–T014 зелёные, `CHECK PASS`

**Checkpoint**: MVP — пользователь видит итог и состав для ×2/×4

---

## Phase 4: User Story 2 — Корзина ×N одной кнопкой (Priority: P1)

**Goal**: основная кнопка ведёт на `cart_url` выбранного варианта и называет множитель.

**Independent Test**: в `dinner` при ×2 ссылка `…=1002`, при ×4 — `…=1004`, при ×1 — как до фичи.

**Зависит от**: US1 (переключатель).

### Tests for User Story 2 (сначала, должны упасть)

- [X] T021 [US2] Тест в `frontend/src/ui/App.test.tsx` (US2.1, US2.2, FR-005, SC-002): при «×1» `link` «Перенести в корзину ВкусВилла» с `href` `https://vkusvill.ru/?share_basket=1001`; при «×2» — `link` «Перенести в корзину ВкусВилла · ×2» с `href` `…=1002`; при «×4» — «… · ×4» и `…=1004`; во всех случаях `target="_blank"` и `rel="noopener noreferrer"`
- [X] T022 [US2] Тест в `frontend/src/ui/App.test.tsx` (US2.3): после «×2» клик по ссылке корзины не сбрасывает выбор — «×2» по-прежнему отмечен

### Implementation for User Story 2

- [X] T023 [US2] В `frontend/src/ui/App.tsx` (`Shelf`) брать `href` ссылки корзины из `active.cart_url` (без вариантов — `c.cart_url`), подпись «Перенести в корзину ВкусВилла» при ×1 и «Перенести в корзину ВкусВилла · ×N» при ×2/×4 (FR-005)
- [X] T024 [US2] Запустить `sh scripts/check.sh frontend`: T021–T022 зелёные, `CHECK PASS`

**Checkpoint**: US1 + US2 — полная ценность фичи

---

## Phase 5: User Story 4 — Недоступный множитель и выкат (Priority: P3)

**Goal**: старый бэкенд не ломает страницу; `available: false` даёт неактивный сегмент с причиной.

**Independent Test**: `breakfast` (без `variants`) — карточка как раньше; вариант ×4 с `available: false` — сегмент неактивен, причина в описании.

**Зависит от**: US1 (переключатель).

### Tests for User Story 4 (сначала, должны упасть)

- [X] T025 [US4] Тест в `frontend/src/ui/App.test.tsx` (US4.3, FR-010): у `breakfast` (без `variants`) и у `withVariants(dinner, …)` из `fixtures.ts` с двумя элементами в `variants` нет `group` «Порции»; итог и ссылка корзины — из `total_price` и `cart_url` подборки, как до фичи
- [X] T026 [US4] Тест в `frontend/src/ui/App.test.tsx` (US4.2, FR-009): `withVariants(dinner, …)` из `fixtures.ts`, где у варианта ×4 `available: false`, `reason: 'больше 40 шт «Яйцо куриное»'` — `radio` «×4» `disabled`, его доступное описание (`aria-describedby`) — этот текст; «×1» и «×2» доступны
- [X] T027 [US4] Тест в `frontend/src/ui/App.test.tsx` (data-model.md, «active»): выбран «×4»; следующий ответ поиска приходит с ×4 `available: false` — карточка показывает итог и ссылку ×1, отмечен «×1»

### Implementation for User Story 4

- [X] T028 [US4] В `frontend/src/ui/App.tsx` у варианта с `available: false` ставить `disabled` на `radio` и `aria-describedby` на `<span id=… className="servings__reason">{reason}</span>` внутри `fieldset`; если выбранный множитель недоступен, активный вариант — ×1 (FR-009)
- [X] T029 [P] [US4] В `frontend/src/styles.css` показывать `.servings__reason` при `:hover` и `:focus-within` группы, скрывать визуально в остальное время так, чтобы текст оставался доступен для `aria-describedby` (не `display: none`); неактивный сегмент — `--muted`, `cursor: not-allowed`
- [X] T030 [US4] Запустить `sh scripts/check.sh frontend`: T025–T027 зелёные, `CHECK PASS`

**Checkpoint**: все истории работают; выкат раньше бэкенда безопасен

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: состояние загрузки страницы, визуальная проверка, документация

- [X] T031 Тест в `frontend/src/ui/App.test.tsx` (FR-015): пока мок `/collections` не ответил (промис, который тест разрешает вручную), в `main` виден текст «Ищем подборки…»; после ответа его нет. Сначала должен упасть
- [X] T032 В `frontend/src/ui/App.tsx` показывать `<p className="notice">Ищем подборки…</p>`, пока `result === null` и нет ошибки (research R-9); `sh scripts/check.sh frontend` → `CHECK PASS`
- [ ] T033 Визуальная проверка по skill frontend-design: `bash scripts/dev.sh`, скриншоты карточки с переключателем на 360 px и на десктопе, самокритика; на 360 px нет горизонтальной прокрутки (SC-006, FR-017). **Блокируется бэкендом команды 2** для карточки с вариантами: проверять, когда их бэкенд (`specs/002-servings-logic`) отдаёт `variants` — `bash scripts/dev.sh` на их ветке после слияния. До этого отметить задачу «частично» и проверить только откат к старой карточке; FR-017 и SC-006 для новой карточки считаются непроверенными до этой проверки (`frontend/src/styles.css`, `frontend/src/ui/App.tsx` при необходимости правок)
  - **Частично (2026-10-21)**: с бэкендом из рабочей копии (без `variants`) — 12 карточек без переключателя, итог и ссылка как до фичи. Карточка с вариантами осмотрена на десктопе и 375 px с подменой ответа `fetch` в браузере (только для осмотра): горизонтальной прокрутки нет (scrollWidth 375 = clientWidth 375); по скриншотам исправлены сдвиг кнопки при ×4 и наложение причины недоступности на итог. Проверка с настоящим бэкендом команды 2 — не сделана.
- [ ] T034 [P] В `docs/features.md` после приёмки обеих команд перенести «Порции ×2 / ×4» из «Можно добавить» в «Сделано» с описанием: переключатель в карточке, три готовые корзины, `variants` в ответе
- [ ] T035 Пройти [quickstart.md](quickstart.md): автоматическая часть — `sh scripts/check.sh frontend` → `CHECK PASS`; ручная — с бэкендом команды 2. В отчёте человеку — фактические команды и их итог; коммит только после приёмки (конституция, принцип VI)
  - **Частично (2026-10-21)**: автоматическая часть — `sh scripts/check.sh frontend` → `CHECK PASS`, 33 теста. Ручная часть ждёт бэкенд команды 2 с `variants`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → истории.
- **US1 (Phase 3)** — после Foundational.
- **US2 (Phase 4)** и **US4 (Phase 5)** — после US1 (нужен переключатель); между собой независимы, но обе правят `App.tsx` и `App.test.tsx`, поэтому выполняются по очереди.
- **Polish (Phase 6)**: T031–T032 не зависят от историй (другая часть `App`), их можно делать сразу после Foundational; T033–T035 — в конце.

### Within Each User Story

- Тест → запуск → падение на утверждении → код → `CHECK PASS`.
- Новый модуль или экспорт сначала появляется заглушкой, чтобы тест падал на утверждении, а не на импорте.
- Порядок в `App.tsx`: состояние (T015) → переключатель (T016) → итог и состав (T017) → бюджет (T018).

### Parallel Opportunities

- T004 и T006 — после T003 (типы и заглушки), в разных файлах (`servings.test.ts`, `api.test.ts`).
- T019 и T029 (`styles.css`) — параллельно с задачами в `App.tsx` своей истории.
- T034 (`docs/features.md`) — независимо от кода.
- Задачи в `App.tsx`/`App.test.tsx` — последовательно: один файл.

---

## Parallel Example: Foundational + User Story 1

```text
# Сразу после T003 (типы и заглушки):
Task: "T004 Падающие тесты readVariants в frontend/src/servings.test.ts"
Task: "T006 Падающие тесты ApiError в frontend/src/api.test.ts"

# Во время T015–T018 (App.tsx):
Task: "T019 Стили .servings и .shelf__over-budget в frontend/src/styles.css (skill frontend-design)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 (откат к старой карточке уже работает).
2. Phase 3 (US1) → `CHECK PASS` → показать: итог и состав для ×2/×4.
3. Остановиться и проверить по Independent Test.

### Incremental Delivery

1. Foundational → страница не меняется, выкат безопасен.
2. + US1 → видно, сколько купить и сколько стоит.
3. + US2 → корзина ×N одной кнопкой (полная ценность).
4. + US4 → защищённый выкат и недоступные множители на будущее.
5. + Polish → загрузка, скриншоты, документация.

### Связь с командой 2

- Фронтенд не ждёт бэкенд: все тесты на фикстурах, без `variants` карточка как раньше. FR-017 и SC-006 для новой карточки закрываются только T033 после готовности бэкенда команды 2.
- Ручная проверка карточки с вариантами (T033, T035) — после того как бэкенд команды 2 отдаёт `variants`.

---

## Notes

- [P] — другой файл и нет зависимости от незавершённых задач.
- Hook после каждой правки сам запускает проверку области; `FAIL` — чинить код, не обходить проверку.
- `docs/requirements.md`, `scripts/check.sh`, `scripts/hooks/`, `.claude/settings.json`, `.specify/feature.json` не трогать.
- Коммит — только после приёмки человеком.
