# Практика 7.1. Сдача домашней работы

Сценарий n8n: **My workflow 23** на `n8n-itmo.cyrweb.ru`, репозиторий `Fufuraziy/ITMOv2`.

- Экспорт сценария из n8n: [workflow.json](workflow.json) (опубликованная версия, 19 нод).
- Тестовый PR: https://github.com/Fufuraziy/ITMOv2/pull/10
- Скриншоты: папка [screenshots/](screenshots/)

## Схема сценария

```
PR Trigger (pull_request, issue_comment)
  └─ Route event (Code) ── событие не наше → выполнение заканчивается
       └─ Other model? (If: mode == other)
            ├─ true  ───────────────────────────────────────────┐
            └─ false → Find PR in Data Table → Not reviewed yet? │
                                                ├─ false → Skip: already reviewed (комментарий в PR)
                                                └─ true ─────────┤
                                                                 ▼
                       Get PR → PR is open? → Get diff → Split diff into blocks
                         → Use DeepSeek? ├─ true  → Review block (DeepSeek) ─┐
                                         └─ false → Review block (OpenAI)  ──┤
                                                                             ▼
                       Build inline review → Publish review → Save PR to Data Table → Add Label to PR1
```

## Что сделано

### 0. Команда `/make_ai_review` и запуск при открытии PR (занятие)

В исходном сценарии условие `open/create PR` проверяло, что `action` содержит `create`. У события открытия PR `action` равен `opened`, поэтому ревью при открытии PR не запускалось. Условие заменено нодой **Route event** (Code). Она смотрит на заголовок `x-github-event` и тело события.

Триггер пересоздан с новым путём webhook. Старый путь был взят из общего gist курса и уже был занят чужим активным workflow на сервере, поэтому n8n отказывался публиковать сценарий (Conflicting Trigger Path).

| Событие | Условие | Результат |
|---|---|---|
| `pull_request` | `action == "opened"` | `mode = main`, основная модель |
| `issue_comment` | `action == "created"`, комментарий к PR, первое слово `/make_ai_review` | `mode = main` |
| `issue_comment` | то же, первое слово `/make_other_ai_review` | `mode = other`, DeepSeek |
| всё остальное | — | пустой выход, выполнение заканчивается |

### 1. Команда `/make_other_ai_review`: вторая модель

- Основная модель: `OpenAI Chat Model1` (`openai/gpt-5.2`), подключена к агенту **Review block (OpenAI)**.
- Вторая модель: `DeepSeek Chat Model` (`deepseek-flash`, нода `lmChatDeepSeek`), подключена к агенту **Review block (DeepSeek)**.
- Модель выбирает нода **Use DeepSeek?** (If по `mode` из Route event). Оба агента получают один и тот же промпт, поэтому результаты двух моделей можно сравнивать напрямую.
- В каждом комментарии внизу указано, какая модель его написала (`🤖 OpenAI (...)` или `🤖 DeepSeek (...)`).

### 2. Data Table

Таблица **`reviewed_prs`** (Overview → Data tables):

| Колонка | Тип | Что хранится |
|---|---|---|
| `repo` | string | `owner/repo` |
| `pr_number` | number | номер PR |
| `model` | string | модель, которая сделала ревью |
| `pr_url` | string | ссылка на PR |
| `id`, `createdAt`, `updatedAt` | системные | — |

После публикации ревью нода **Save PR to Data Table** (Insert) добавляет строку.

**Что считается id PR.** PR идентифицируется парой `repo` + `pr_number`. Номер PR (`#10`) уникален внутри репозитория, по нему GitHub API адресует PR (`/repos/{repo}/pulls/{number}`), и только он приходит в обоих событиях: и в `pull_request`, и в `issue_comment`. Во втором случае в payload есть только `issue.number`, внутреннего `pull_request.id` там нет. Поэтому проверка повторов и запись в таблицу используют именно эту пару, а `pr_url` хранится для наглядности.

### 3. Защита от повторного запуска

Для `mode = main` (открытие PR и `/make_ai_review`) перед ревью выполняется нода **Find PR in Data Table** (Get, условия `repo = …` И `pr_number = …`, limit 1, включено *Always Output Data*). Затем **Not reviewed yet?** проверяет, пуст ли `id` у найденной строки:

- строки нет → ревью запускается;
- строка есть → ветка `false`: нода **Skip: already reviewed** пишет в PR короткий комментарий о пропуске, а модель не вызывается. В Executions видно, что выполнение закончилось на этой ветке, а ноды `Get diff` и `Review block…` не запускались.

`/make_other_ai_review` таблицей не ограничен: команда нужна, чтобы явно запросить второе мнение.

### 4*. Точечные комментарии

Нода **Split diff into blocks** (Code) разбирает unified diff:

1. Для каждого файла и hunk отслеживает номера строк старой и новой версии (`@@ -a,b +c,d @@`).
2. Блок — это непрерывная последовательность строк `+`/`-`. Изменения, между которыми не больше 3 строк контекста, объединяются в один блок.
3. Длинные блоки (например, целиком новый файл) режутся по началу `def`/`class`/декоратора (после 12 строк) и не бывают длиннее 60 строк.
4. Для блока вычисляется диапазон `start_line…line` в новой версии файла (`side = RIGHT`). Если в блоке только удаления, используются номера старой версии (`side = LEFT`).
5. В модель уходит текст блока с номерами строк и 3 строки контекста перед ним. Отдельный вызов модели на каждый блок, не больше 25 блоков на PR.

Нода **Build inline review** собирает ответы модели в один review: общий итог в `body` и массив `comments` с `path`, `start_line`, `line`, `side`. **Publish review** отправляет его одним запросом `POST /repos/{repo}/pulls/{n}/reviews`. Поэтому каждый комментарий привязан к диапазону строк своего блока в PR (multi-line comment), а не ко всему diff.

## Чем отличаются результаты двух моделей (PR #10, одинаковый промпт, 18 блоков)

| | OpenAI `openai/gpt-5.2` | DeepSeek `deepseek-flash` |
|---|---|---|
| Время выполнения | 1 мин 8 с (#706) | 4 мин 18 с (#718) |
| Блоков с замечаниями | 18 из 18 | 12 из 18 (6 «замечаний нет») |
| Характер замечаний | подробные, с кодом исправлений; есть ложные срабатывания из-за узкого контекста блока (например, «нет импорта `closing`», хотя импорт есть в другом блоке) | короче и конкретнее, меньше шума; часть блоков пропускает |

Пример: на блоке `app.py` строки 48–59 OpenAI нашёл две «проблемы», а DeepSeek ответил «замечаний нет» ([скриншот](screenshots/08-inline-compare-openai-vs-deepseek.jpg)).

## Что показать ревьюверу

- **Выбор модели:** Route event → `mode`, затем Use DeepSeek? → один из двух агентов. Различия результатов видно в тестовом PR: два review с подписями моделей и таблица выше.
- **Где состояние:** Data Table `reviewed_prs`, решение принимают ноды Find PR in Data Table и Not reviewed yet?.
- **Повторный `/make_ai_review`:** выполнение уходит в Skip: already reviewed (скриншот Executions и комментарий в PR).
- **Блоки:** Split diff into blocks (алгоритм выше) и Publish review (`start_line`/`line`).

## Подтверждения запусков

Порядок запусков в PR #10: открытие PR → `/make_ai_review` (повтор) → `/make_other_ai_review`.

| Критерий | Execution | Скриншоты |
|---|---|---|
| — схема сценария | — | [00-workflow.png](screenshots/00-workflow.png) |
| 0. Открытие PR → ревью основной моделью | #706, 1 мин 8 с | [01-execution-pr-opened.jpg](screenshots/01-execution-pr-opened.jpg), [02-pr-review-openai.jpg](screenshots/02-pr-review-openai.jpg) |
| 1. `/make_other_ai_review` → ревью DeepSeek опубликовано в PR | #718, 4 мин 18 с | [06-execution-other-ai-review.jpg](screenshots/06-execution-other-ai-review.jpg), [12-exec718-review-block-deepseek.jpg](screenshots/12-exec718-review-block-deepseek.jpg) (агент DeepSeek: 18 блоков на входе, 18 ответов, `model: deepseek-flash`), [07-pr-other-ai-review-deepseek.jpg](screenshots/07-pr-other-ai-review-deepseek.jpg) |
| 2. Data Table: id PR сохраняется после ревью | #706 | [10-exec706-save-pr-to-datatable.jpg](screenshots/10-exec706-save-pr-to-datatable.jpg) (нода Insert в запуске: `repo`, `model`, `pr_url`, `pr_number = 10`), [03-datatable-after-first-review.jpg](screenshots/03-datatable-after-first-review.jpg) (1 строка), [09-datatable-final.jpg](screenshots/09-datatable-final.jpg) (2 строки: openai и deepseek) |
| 3. Повторный `/make_ai_review` не запускает ревью | #715, 1,1 с | [13-exec715-not-reviewed-yet-false.jpg](screenshots/13-exec715-not-reviewed-yet-false.jpg) (Find PR нашла строку `id = 1`, условие `$json.id is empty` → **False Branch**), [04-execution-repeat-skipped-zoom.jpg](screenshots/04-execution-repeat-skipped-zoom.jpg), [04-execution-repeat-skipped.jpg](screenshots/04-execution-repeat-skipped.jpg), [04-pr-repeat-skipped-comment.jpg](screenshots/04-pr-repeat-skipped-comment.jpg); содержимое таблицы перед повтором — [03](screenshots/03-datatable-after-first-review.jpg) |
| 4*. Точечные комментарии к каждому блоку | #706, #718 | [11-exec706-publish-review-inline-payload.jpg](screenshots/11-exec706-publish-review-inline-payload.jpg) (тело запроса: `comments[]` с `path`/`side`/`line`, ответ GitHub с id review), [05-inline-comment-openai.jpg](screenshots/05-inline-comment-openai.jpg), [08-inline-compare-openai-vs-deepseek.jpg](screenshots/08-inline-compare-openai-vs-deepseek.jpg) |

Короткие запуски на 0,1–0,2 с (14:03:33 и #716) — это события, которые вызвал сам сценарий: метка `labeled` и комментарий о пропуске. Route event их отбрасывает, зацикливания нет.

## Настройка перед запуском (при импорте JSON на другой инстанс)

1. Создать credentials GitHub, OpenAI-совместимый и DeepSeek и выбрать их в нодах.
2. Создать Data Table `reviewed_prs` (колонки `repo`, `model`, `pr_url` — string, `pr_number` — number) и выбрать её в нодах Find PR in Data Table и Save PR to Data Table.
3. Опубликовать сценарий (**Publish**). Trigger сам зарегистрирует webhook в репозитории.
