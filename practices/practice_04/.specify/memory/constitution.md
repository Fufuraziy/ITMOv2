<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: placeholders → 6 principles
  I. TDD для backend через tdd-go
  II. Только стандартная библиотека Go
  III. Ошибки — значения
  IV. Единый runner scripts/check.sh
  V. Защищённые файлы меняются только по поручению
  VI. Коммит только после приёмки человеком
- Added sections: Стек и границы, Процесс разработки, Governance
- Removed sections: none (5 principle slots of the template extended to 6)
- Sources: AGENTS.md, docs/style-guide.md (no new principles introduced)
- Templates: not modified (scope of /speckit-constitution); plan/spec/tasks templates
  read the constitution at runtime.
- Follow-up TODOs: none
-->
# VV Collections Constitution

## Core Principles

### I. TDD для backend через tdd-go (NON-NEGOTIABLE)

Любое изменение поведения в `backend/` (новая проверка, обработчик, метод `Store`,
исправление бага) MUST идти через skill **tdd-go**: `RED OK` → минимальная реализация →
`GREEN OK` → рефакторинг. Тест MUST сначала падать на утверждении, потом проходить без
регрессий. Фазы записываются в `docs/evidence/tdd-journal.md`.

- Поведение проверяется через публичный интерфейс: `collections.Service` и
  HTTP-обработчики, а не приватные поля (образец — `TestService_Search`,
  `TestAPI_SearchBadQuery`).
- Запрещено ослаблять проверки ради зелёного результата: `t.Skip`, удаление чужих
  тестов, правка ожиданий под код.

Обоснование: проект — MVP со строгим TDD; скрипт `scripts/tdd.mjs` механически
подтверждает цикл, поэтому соблюдение проверяемо.

### II. Только стандартная библиотека Go

Бэкенд (Go 1.22+) MUST использовать только стандартную библиотеку: `net/http` с шаблонами
маршрутов Go 1.22+, без фреймворков ради маленькой правки. Новая зависимость допускается
только с обоснованием в PR.

Обоснование: меньше поверхности для поддержки; стандартной библиотеки хватает для
read-only HTTP API и in-memory хранилища.

### III. Ошибки — значения, а не строки

- Проверка каталога MUST возвращать `*collections.ValidationError` со списком всех проблем.
- Отсутствие подборки — `collections.ErrNotFound`, проверяется через `errors.Is`.
- Сообщения ошибок — в нижнем регистре, без точки в конце.
- Всё, что ходит в хранилище (`Store`, `Service`), принимает `context.Context` первым
  параметром.

Обоснование: вызывающий код и тесты различают ошибки по типу, а не по тексту; будущая
Postgres-реализация получит контекст без смены интерфейса.

### IV. Единый runner `scripts/check.sh`

Проверка проекта выполняется одной командой `sh scripts/check.sh [backend|frontend|mcp|skill|hooks]`
(без аргумента — всё; для backend: gofmt → vet → test). Итог — последняя строка `CHECK PASS`
или `CHECK FAIL`. `FAIL` от hook после правки значит «исправь код», а не «обойди проверку».
В отчётах приводятся фактически выполненные команды и их итог, а не пересказ.

Обоснование: один источник истины о состоянии проекта для человека, агента и hooks.

### V. Защищённые файлы меняются только по поручению

Без явного поручения человека MUST NOT меняться: `docs/requirements.md` (контракт R1–R5),
`scripts/check.sh`, `scripts/hooks/`, `.claude/settings.json`, `opencode.json`. Если в
контракте нет нужного пункта — спросить, а не дописывать.

Обоснование: контракт и runner задают, что считается правильным; их правка под код
обесценивает проверки.

### VI. Коммит только после приёмки человеком

Агент MUST NOT делать commit до того, как человек принял изменения.

Обоснование: человек остаётся последней точкой контроля над историей репозитория.

## Стек и границы

- Backend — Go 1.22+ (позже Postgres), frontend — React + TypeScript (Vite, Vitest).
- Файлы пишутся только внутри репозитория; инструменты и кэши — только в `.tools/`.
- Каталог `backend/catalog/collections.json` руками не правится: меняются темы в
  `catalog/themes.json`, затем пересборка через `mcp/vv-collections/curate.mjs`; товары и
  `xml_id` — только из MCP ВкусВилла.

## Процесс разработки

- Изменение поведения backend → tdd-go (принцип I) → `sh scripts/check.sh` (принцип IV).
- Изменение внешнего вида → skill **frontend-design**: план, код, скриншот, самокритика.
- Перед изменением кода прочитать `docs/style-guide.md`.
- Готовая работа передаётся человеку на приёмку; commit — после неё (принцип VI).

## Governance

- Конституция стоит выше прочих практик; оперативные инструкции для агента — `AGENTS.md`
  и `docs/style-guide.md`, они не должны ей противоречить.
- Поправки вносятся только по поручению человека, с обновлением Sync Impact Report.
- Версионирование — semver: MAJOR — удаление или переопределение принципа; MINOR — новый
  принцип или раздел; PATCH — уточнения формулировок.
- Каждый план (`/speckit-plan`) и ревью проверяет соответствие принципам I–VI; отступление
  обосновывается явно.

**Version**: 1.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
