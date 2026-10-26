# Implementation Plan: Переключатель порций ×1 / ×2 / ×4 (UI)

**Branch**: `practice_05` (отдельная ветка не создавалась) | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-servings-ui/spec.md`

**Owner**: команда 1 (frontend). Бэкенд, `curate.mjs`, контракт — команда 2 (`specs/002-servings-logic`).

## Summary

В каждой карточке выдачи появляется переключатель «Порции» ×1/×2/×4. Все три варианта (итог, количества, ссылка на корзину) уже приходят в ответе поиска в массиве `variants`, поэтому переключение — чисто клиентское: без запросов, без вычислений, только выбор нужного варианта. Выбор хранится в состоянии страницы по `id` подборки и живёт до перезагрузки. Если бэкенд ещё без фичи (нет `variants` или он неполный), карточка остаётся как сейчас — фронтенд можно выкатывать раньше бэкенда.

Технически: расширить типы в `frontend/src/api.ts` необязательными полями, вынести разбор вариантов в чистый модуль `frontend/src/servings.ts`, поднять выбор множителя из `Shelf` в `App`, добавить сегментный переключатель на нативных radio, пометку «больше бюджета», строку «Ищем подборки…» и класс ошибки API с полем `code`. Тесты — Vitest + Testing Library, сначала красные.

## Technical Context

**Language/Version**: TypeScript 5.4, React 18.2 (frontend); бэкенд не меняется этой фичей

**Primary Dependencies**: только уже установленные — React, Vite 5.4; новых зависимостей нет

**Storage**: нет. Выбор множителя — состояние React в памяти страницы; адрес и `localStorage` не используются (FR-011)

**Testing**: Vitest 1.6 + @testing-library/react 16 (jsdom); запуск — `sh scripts/check.sh frontend` (`tsc --noEmit` + `vitest run`)

**Target Platform**: современные браузеры, ширина от 360 px (FR-017, SC-006)

**Project Type**: web-application, меняется только `frontend/`

**Performance Goals**: смена множителя отрисовывается до 0,2 с без сетевых запросов (SC-001) — тривиально, т. к. данные уже в памяти

**Constraints**: без запросов при переключении (FR-003); UI не умножает и не округляет (FR-003, FR-004); `servings` в поиск не передаётся (FR-018); старый ответ без `variants` работает как раньше (FR-010)

**Scale/Scope**: каталог ~десятки подборок, до 20 товаров в каждой; 1 экран, 1 компонент-переключатель, ~8 новых тестов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Применимость | Статус |
|---|---|---|
| I. TDD для backend через tdd-go | бэкенд не меняется. Для фронтенда держим тот же цикл: тест → красный → код → зелёный (AGENTS.md: «MVP строго через TDD») | PASS |
| II. Только стандартная библиотека Go | Go не трогаем; во фронтенде новых зависимостей нет | PASS |
| III. Ошибки — значения | бэкенд не трогаем; на фронтенде ошибки API — класс `ApiError` со `status` и `code`, ветвление по `code`, не по тексту (FR-019) | PASS |
| IV. Единый runner `scripts/check.sh` | проверка — `sh scripts/check.sh frontend`, итог `CHECK PASS` | PASS |
| V. Защищённые файлы | `docs/requirements.md`, `scripts/check.sh`, hooks, settings не меняются; правку контракта под `variants`/`code` делает команда 2 по поручению человека | PASS |
| VI. Коммит после приёмки | коммитов нет до приёмки человеком | PASS |
| Процесс: внешний вид через frontend-design | переключатель и пометка бюджета — через skill: план, код, скриншоты 360 px и десктоп, самокритика | PASS (задача в tasks) |

Нарушений нет, раздел Complexity Tracking не нужен.

## Project Structure

### Documentation (this feature)

```text
specs/001-servings-ui/
├── plan.md              # этот файл
├── research.md          # Phase 0: решения и альтернативы
├── data-model.md        # Phase 1: типы фронтенда и состояние выбора
├── quickstart.md        # Phase 1: как проверить фичу
├── contracts/
│   ├── api-consumed.md  # что UI читает из API (подмножество гарантий команды 2)
│   └── ui-card.md       # доступные имена, роли и тексты карточки — на них опираются тесты
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, не создаётся здесь)
```

### Source Code (repository root)

```text
frontend/src/
├── api.ts             # + типы Variant, поля Product.scalable/base_quantity, Collection.variants/servings; ApiError {status, code}
├── servings.ts        # НОВЫЙ: readVariants(c) → Variant[] | null, строки состава для варианта, overBudget()
├── servings.test.ts   # НОВЫЙ: модульные тесты разбора вариантов
├── api.test.ts        # НОВЫЙ: ApiError со status и code
├── styles.css         # + .servings (сегменты), .shelf__over-budget, раскладка 360 px
└── ui/
    ├── App.tsx        # выбор множителя в App (Record<id, 1|2|4>); «Ищем подборки…»; Shelf получает multiplier и onChange
    ├── App.test.tsx   # + сценарии US1, US2, US4, FR-015, FR-016, FR-018
    ├── fixtures.ts    # НОВЫЙ: тестовые подборки с variants (dinner, soup), withVariants()
    └── test-utils.tsx # без изменений
```

**Structure Decision**: веб-приложение с готовыми `backend/` и `frontend/`; фича трогает только `frontend/src`. Новый модуль один — `servings.ts`, чтобы правила разбора ответа проверялись без отрисовки и не раздували `App.tsx`. Отдельный файл компонента не заводим: `Shelf` уже живёт в `App.tsx`, переключатель — маленькая функция рядом.

## Зависимость от команды 2

- Фронтенд не ждёт бэкенд: без `variants` карточка как сейчас (FR-010), тесты идут на фикстурах.
- Имя массива `variants` и значения `code` (`invalid_query`, `collection_not_found`, `internal_error`) сверены с `specs/002-servings-logic/contracts/http-api.md` (см. [research.md](research.md), R-6, R-7).
- Правка `docs/requirements.md` — не наша.

## Post-Design Constitution Check

После Phase 1 (data-model, contracts, quickstart): новых зависимостей, изменений бэкенда, защищённых файлов и хранилищ не появилось; ошибки моделируются значением `ApiError`; проверка — через `scripts/check.sh frontend`. Все гейты — PASS.
