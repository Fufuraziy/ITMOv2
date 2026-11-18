# Практика 7.2. Сдача домашней работы

n8n: `n8n-itmo.cyrweb.ru`. Тестовый репозиторий: https://github.com/Fufuraziy/ITMOv2/issues

| Сценарий | Экспорт |
|---|---|
| Workflow 1: классификация Issues (My workflow 49) | [My workflow 49.json](My%20workflow%2049.json) |
| Sub-workflow классификатора (My workflow 56) | [My workflow 56.json](My%20workflow%2056.json) |
| Сценарий статистики | [Weekly Issues stats (practice 7.2).json](Weekly%20Issues%20stats%20(practice%207.2).json) |

Тестовые Issues всех типов:

| Issue | Лейбл |
|---|---|
| [#13](https://github.com/Fufuraziy/ITMOv2/issues/13) | `bug` |
| [#14](https://github.com/Fufuraziy/ITMOv2/issues/14) | `feature` |
| [#15](https://github.com/Fufuraziy/ITMOv2/issues/15) | `task` |
| [#16 «Что-то не так»](https://github.com/Fufuraziy/ITMOv2/issues/16) — расплывчатый | `needs-triage` |

## Часть 1. Workflow 1 и Sub-workflow

```
Issue Trigger (issues) → Edit Fields → If Opened (action == opened)
  → If (author_association == NONE) ─true→ лейбл first-time-contributor + приветственный комментарий ─┐
                                    └false──────────────────────────────────────────────────────────┤
  → Call 'My workflow 56' (Execute Workflow: title, body → output.type, output.confidence)
  → If1 (confidence ≥ 0.8) ─true→ Switch по type: bug / feature / task → свой лейбл
                           └false→ Merge → Add Label to Issue4: needs-triage   (Switch: unknown → туда же)
```

- **Как классификатор возвращает тип и confidence.** Sub-workflow `My workflow 56` начинается с Execute Workflow Trigger («When Executed by Another Workflow») и принимает `title` и `body`. Внутри Basic LLM Chain с Structured Output Parser (JSON parser) возвращает `{ "output": { "type": "bug|task|feature|unknown", "confidence": 0..1 } }`.
- **Как Switch выбирает ветку.** `If1` пропускает в `Switch` только результаты с `confidence ≥ 0.8`. Дальше `Switch` сравнивает `output.type` с `bug`, `feature`, `task` и ставит соответствующий лейбл. `unknown` и fallback отправляются в ветку `needs-triage`.
- **Почему #16 попал в `needs-triage` и почему на нём нет комментария.** Классификатор вернул `type: "bug"`, но с `confidence: 0.62` (скриншот `03-if1…`). Это меньше 0.8, поэтому сработал False Branch: `Merge` → лейбл `needs-triage`. В этой ветке нет ноды комментария. Комментарий есть только в ветке first-time-contributor (`author_association == NONE`), а автор Issue — владелец репозитория.
- **Вызов Sub-workflow.** Основной сценарий вызывает его нодой Execute Workflow `Call 'My workflow 56'`. Туда передаются `title` и `body` Issue, обратно приходят `output.type` и `output.confidence`. Для всех типов поведение то же, что до выноса: #13–#15 получили свои лейблы.

Правки после занятия:
- порог в `If1`: было `> 0.4`, стало `≥ 0.8`, плюс включено приведение типов: если confidence не пришёл, Issue уходит в `needs-triage`;
- лейбл ветки unknown: было `unknown`, стало `needs-triage`;
- триггер пересоздан с собственным путём webhook: старый путь конфликтовал с другим workflow;
- оба сценария опубликованы.

## Часть 2. Еженедельная статистика → Gmail

```
Every Monday 09:00 (cron 0 9 * * MON) ─┐
Manual run ────────────────────────────┴→ Week range
  → GitHub: issues opened → GitHub: issues closed → GitHub: PRs opened → GitHub: PRs merged
  → Group stats → Save week to Data Table (upsert) → Load history → Compute delta
  → AI weekly comment (Basic LLM Chain + OpenAI Chat Model) → Build HTML email → Send weekly report (Gmail)
```

### 4. Cron и запросы к GitHub API

- **Триггер.** `Every Monday 09:00`: Schedule Trigger, `Custom (Cron)` = `0 9 * * MON`. Для проверки сценарий запускался вручную через `Manual run`, README это разрешает.
- **Окно.** `Week range` берёт последние 7 дней до запуска (`since`…`until`). При запуске по cron это прошедшая неделя.
- **Четыре запроса** `GET https://api.github.com/search/issues` с credential GitHub:

| Нода | `q` |
|---|---|
| GitHub: issues opened | `repo:Fufuraziy/ITMOv2 is:issue created:{since}..{until}` |
| GitHub: issues closed | `repo:Fufuraziy/ITMOv2 is:issue is:closed closed:{since}..{until}` |
| GitHub: PRs opened | `repo:Fufuraziy/ITMOv2 is:pr created:{since}..{until}` |
| GitHub: PRs merged | `repo:Fufuraziy/ITMOv2 is:pr is:merged merged:{since}..{until}` |

### 5. Группировка (Code node `Group stats`)

- **По типу.** Тип определяется по лейблам, которые поставил Workflow 1: `bug` / `feature` / `task`, а `needs-triage` и `unknown` считаются как `needs-triage`. Issue без лейбла идёт в `unlabeled`. Для каждого типа считается, сколько открыто и сколько закрыто.
- **По автору.** Для каждого `user.login` считаются `issues_opened`, `issues_closed`, `prs_opened` и `prs_merged`.
- **Итоги** — сумма по каждому из четырёх запросов.

### 6. HTML-письмо через Gmail node

`Build HTML email` собирает письмо. В нём:
- таблицы «Итоги недели», «По типу Issues» и «По автору»;
- список Issues за неделю;
- блок «🤖 AI-комментарий недели».

`Send weekly report (Gmail)` отправляет его с `emailType: html`.

### 7*. Data Table

Таблица `weekly_issue_stats`:

| Колонки | Тип |
|---|---|
| `week_start`, `week_end` | string |
| `by_type`, `by_author` | string (JSON) |
| `issues_opened`, `issues_closed`, `prs_opened`, `prs_merged` | number |

`Save week to Data Table` делает upsert по `week_start`, поэтому повторный запуск в тот же день не создаёт дубль.

- Неделя `2026-11-04 — 2026-11-11`: **тестовая запись**, внесена вручную, README разрешает сымитировать вторую неделю.
- Неделя `2026-11-11 — 2026-11-18`: реальные данные, записаны сценарием.

### 8*. Δ к прошлой неделе

**Откуда данные прошлой недели.** `Load history` читает все строки `weekly_issue_stats`. `Compute delta` выбирает самую позднюю строку с `week_start` раньше текущей и считает Δ по четырём метрикам и по каждому типу (из `by_type`).

В письме Δ показан колонками ▲/▼. Например, Issues открыто: 6 против 3, то есть ▲ +3; needs-triage: ▲ +2.

### 9*. AI-комментарий недели

**На основе чего пишет LLM.** `AI weekly comment` — Basic LLM Chain с моделью `openai/gpt-5.2`. Она получает статистику недели (итоги, по типам и по авторам), данные прошлой недели из Data Table и Δ. Текст выводится в письме блоком «🤖 AI-комментарий недели».

## Подтверждения запусков

| # | Критерий | Execution | Скриншоты |
|---|---|---|---|
| 1 | Issue классифицирован, лейбл стоит | #2772 (bug #13) | [01-github-issues-labels](screenshots/01-github-issues-labels.jpg), [02-execution-issue13-bug](screenshots/02-execution-issue13-bug.jpg) |
| 2 | `confidence < 0.8` → `needs-triage` | #2788 (#16) | [03-execution-issue16-needs-triage](screenshots/03-execution-issue16-needs-triage.jpg), [03-if1-confidence-062-false-branch](screenshots/03-if1-confidence-062-false-branch.jpg) |
| 3 | Sub-workflow через Execute Workflow | #2789 (sub-workflow для #16) | [04-subworkflow-execution-issue16](screenshots/04-subworkflow-execution-issue16.jpg), а также Issues #13–#15 на [01](screenshots/01-github-issues-labels.jpg) |
| 4 | Cron настроен, GitHub API вернул данные за неделю | #3075 | [05-stats-cron-trigger](screenshots/05-stats-cron-trigger.png), [06-stats-execution](screenshots/06-stats-execution.png), [07-github-issues-opened](screenshots/07-github-issues-opened.png) (`total_count: 6`) |
| 5 | Группировка по типу и автору | #3075 | [08-group-stats](screenshots/08-group-stats.png) |
| 6 | HTML-письмо пришло через Gmail | #3075 | [10-email](screenshots/10-email.png) |
| 7 | Статистика в Data Table | #3075 | [09-datatable-2-weeks](screenshots/09-datatable-2-weeks.png) |
| 8 | Δ к прошлой неделе по данным Data Table | #3075 | [11-compute-delta](screenshots/11-compute-delta.png), [10-email](screenshots/10-email.png) |
| 9 | Блок «AI-комментарий недели» | #3075 | [12-ai-weekly-comment](screenshots/12-ai-weekly-comment.png), [10-email](screenshots/10-email.png) |

На каждый Issue Workflow 1 даёт два запуска. Первый, около 3 с, — это `opened` с классификацией. Второй, около 0,2 с, — событие `labeled`, которое вызвала простановка лейбла. Нода `If Opened` его отбрасывает.
