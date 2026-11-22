# Практика 8: фронтенд проекта с помощью AI

Проект — «Подборки ВкусВилла» из практики 4 (Go + React), скопирован в [`app/`](app/). Добавлены раздел **«Заявки куратору»**: форма, валидация, состояния, защита от повторной отправки и клиентские тесты, и бэкенд для него (`POST/GET /suggestions`, R8). Вся вёрстка переведена на **shadcn/ui**.

- Исходники фронтенда и тесты: [`app/frontend/`](app/frontend/); как установить, запустить и протестировать — в [`app/README.md`](app/README.md).
- Макет (v0): [`mockup/`](mockup/README.md).
- Скриншоты работы на настоящем API: [`docs/screens/`](docs/screens/).
- Результаты тестов: [`docs/evidence/frontend-tests.txt`](docs/evidence/frontend-tests.txt) (78/78), [`docs/evidence/check-all.txt`](docs/evidence/check-all.txt) (`CHECK PASS`), [`docs/evidence/mutation-check.txt`](docs/evidence/mutation-check.txt).

## Основной сценарий

**Кто и зачем.** Посетитель каталога ищет готовый набор продуктов под повод и бюджет. Если подходящей подборки нет, он предлагает куратору новую. Подборки собирает куратор, и заявка — способ сказать ему, чего не хватает.

**Путь.** Вкладка «Заявки куратору» (или «Предложить такую подборку» из пустого поиска) → «Предложить подборку» → форма в диалоге: название*, повод, бюджет*, что должно войти, почта → «Отправить заявку» → «Отправляем…» → диалог закрывается, уведомление «Заявка отправлена», заявка первой в списке с пометкой «новая». Заявка хранится на бэкенде: `GET /suggestions` её возвращает.

| | Скриншот (настоящий API) |
|---|---|
| пустые данные | [01-empty-list](docs/screens/01-empty-list.jpg) |
| диалог открыт, фокус в первом поле | [02-dialog-open](docs/screens/02-dialog-open.jpg) |
| обязательные поля | [03-validation-required](docs/screens/03-validation-required.jpg) |
| заполнено с клавиатуры | [04-filled-by-keyboard](docs/screens/04-filled-by-keyboard.jpg) |
| некорректный ввод | [05-invalid-email](docs/screens/05-invalid-email.jpg) |
| **загрузка** (отправка, сервер отвечает с задержкой) | [06-submitting](docs/screens/06-submitting.jpg) |
| **успех** | [07-success](docs/screens/07-success.jpg) |
| **ошибка** загрузки списка (бэкенд остановлен) | [08-list-error](docs/screens/08-list-error.jpg) |
| **ошибка** отправки, данные сохранены | [09-submit-error](docs/screens/09-submit-error.jpg) |
| «Повторить» после запуска бэкенда | [10-retry-success](docs/screens/10-retry-success.jpg) |
| поиск на shadcn/ui | [11-search](docs/screens/11-search.jpg) |
| пустой поиск → «Предложить такую подборку» | [12-search-empty](docs/screens/12-search-empty.jpg), [13-suggest-from-search](docs/screens/13-suggest-from-search.jpg) |
| узкий экран 375 px | [14-mobile-list](docs/screens/14-mobile-list.jpg), [15-mobile-validation](docs/screens/15-mobile-validation.jpg) |

Загрузку списка на настоящем API не видно: он отвечает мгновенно. Это состояние (скелетоны) есть в макете ([v2/08](mockup/screens/v2/08-loading.jpg)) и проверяется тестом с задержанным ответом.

## Соответствие критериям

| # | Критерий | Где подтверждение |
|---|---|---|
| 1 | Макет с AI, доступен, сценарий, вклад AI | v0, три итерации: [mockup/README.md](mockup/README.md), [v0-prompts.md](mockup/v0-prompts.md), [screens/v1–v3](mockup/screens/) |
| 2 | Библиотека компонентов | shadcn/ui, указана в [app/README.md](app/README.md); компоненты в [`components/ui/`](app/frontend/src/components/ui/); таблица «макет ↔ компонент» в [mockup/README.md](mockup/README.md#макет--интерфейс) |
| 3 | Единые цвета, типографика, отступы | токены темы — [`index.css`](app/frontend/src/index.css) (`:root`), шрифт Onest, шкала отступов Tailwind; в коде фич нет ни одного hex‑цвета |
| 4 | Полный сценарий с реальным API | `POST /suggestions` → карточка в списке: скриншоты 02–10; бэкенд [`internal/suggestions`](app/backend/internal/suggestions/), [`httpapi/suggestions.go`](app/backend/internal/httpapi/suggestions.go) |
| 5 | Соответствие макету | макет v2 → реализация → макет v3 обновлён под изменения ([раздел «Синхронизация»](mockup/README.md#синхронизация-с-реализацией-запрос-3)) |
| 6 | Подписи, клавиатура, фокус | у всех полей `<label>`, ошибки связаны через `aria-describedby`, фокус — сплошная зелёная рамка 3 px (`--ring`), после закрытия диалога фокус возвращается; сценарий только с клавиатуры — тест в [App.test.tsx](app/frontend/src/App.test.tsx) и скриншот 04 |
| 7 | Нет повторной отправки + тест | ref‑флаг `inFlight` в [SuggestionDialog.tsx](app/frontend/src/features/suggestions/SuggestionDialog.tsx) + `fieldset disabled` + `disabled` у кнопок; тесты «двойной клик и Enter» и «два submit в одном тике» — ровно 1 POST |
| 8 | Тесты компонентов и взаимодействий | [test-plan.md](docs/test-plan.md): открытие и закрытие диалога (Отмена/крестик/Escape), ввод, клики, вкладки |
| 9 | Валидация | обязательные поля, 6 видов некорректного ввода, ошибки 400/409 от сервера |
| 10 | Состояния с подменой ответов | загрузка, пусто, успех, ошибка 500, сеть недоступна; моки сверены с живым API ([contract.test.ts](app/frontend/src/test/contract.test.ts)) |
| 11 | Сценарий целиком | [App.test.tsx](app/frontend/src/App.test.tsx): вкладка → форма → отправка → карточка первой |

## Почему двойной клик и Enter не отправляют форму повторно

1. `inFlight = useRef(false)`: обработчик submit выходит сразу, если флаг поднят. Ref меняется синхронно, поэтому второй submit в том же тике видит `true`, даже если React ещё не перерисовал кнопку.
2. Пока идёт запрос, `<fieldset disabled>` блокирует поля, и Enter в поле не отправляет форму; кнопки «Отправить» и «Отмена» тоже `disabled`.
3. Диалог нельзя закрыть во время отправки (Escape, крестик), иначе ответ пришёл бы в закрытую форму.

Проверено тестами (1 запрос при `dblClick` + `click` + Enter и при двух `requestSubmit()` подряд) и вручную на настоящем API: двойной Enter и двойной клик создали по одной заявке, на сервере `total` вырос на 1.

## Тестирование

```text
$ cd app/frontend && npx vitest run
 Test Files  7 passed (7)
      Tests  78 passed (78)

$ sh app/scripts/check.sh
[backend]  ok gofmt / ok go vet / ok go test
[frontend] ok tsc --noEmit / ok vitest
[mcp] ok   [skill] ok   [hooks] ok
CHECK PASS (backend frontend mcp skill hooks)
```

Бэкенд R8 сделан через TDD (skill tdd-go): `RED OK` → `GREEN OK` для `TestService_*` и `TestAPI_*Suggestion*`, журнал — [`app/docs/evidence/tdd-journal.md`](app/docs/evidence/tdd-journal.md) (записи от 2026‑11‑22).

Как проверено качество тестов, созданных AI: [docs/test-plan.md](docs/test-plan.md). Каждый тест сопоставлен с действием пользователя; поведение ломалось четыре раза, и каждый раз падали нужные тесты; моки сверены с живым API.

## Как использовался AI

**Инструменты:** v0 (Vercel) — макет; Claude Code (Opus 5.5) — бэкенд, фронтенд и тесты; shadcn CLI — генерация компонентов.

**Примеры запросов.**
- Макет: три запроса в [mockup/v0-prompts.md](mockup/v0-prompts.md). Первый — сценарий, поля и 9 состояний; второй — 8 правок по итогам проверки; третий — синхронизация с кодом.
- Интерфейс: «Реализуй форму заявки по макету v2 на компонентах shadcn/ui из `src/components/ui`, не создавай свои кнопки и поля; цвета только из токенов темы; защита от повторной отправки; ошибки сервера по полям из `fields`».
- Тесты: «Предложи проверки сценария заявки: каждая — действие пользователя и видимый результат; ответы сервера подменяй в формате Go‑бэкенда: успех, пусто, задержка, 400/409/500, сеть; отдельно — повторная отправка во время ожидания».

**Что пришлось исправлять.**
- *shadcn CLI:* сгенерированные компоненты импортировали `cn` из стороннего npm‑пакета `cn`, а не из `@/lib/utils`, и сам `utils.ts` реэкспортировал его. Исправлено, пакет удалён. Компоненты рассчитаны на React 19 (`ref` как проп): с React 18 не сходились типы, а `ref` на `Button` не работал, поэтому React обновлён до 19. Дефолтная тема (Geist, серая палитра, `bg-black/10` у оверлея, полупрозрачная рамка фокуса с контрастом около 2:1) заменена токенами проекта, рамка фокуса стала сплошной. Размеры кнопок и полей увеличены с 32 до 40–44 px.
- *Макет v0:* лишний декор, стрелки в кнопках, «отправка» выглядела как очищенная форма, ошибка и подсказка дублировали друг друга. Подробно — в [mockup/README.md](mockup/README.md).
- *Интерфейс:* та же проблема, что в макете v1, нашлась и в коде: shadcn делает заблокированные поля `opacity-50`, и значения выглядели как плейсхолдеры. Исправлено. Плейсхолдер бюджета «1500» путали с введённым значением, поэтому теперь «Например, 1500».
- *Тесты:* нашли реальную ошибку доступности — фокус после закрытия диалога уходил на `body`. Ещё четыре неверных проверки исправлены, добавлены тест на гонку и контрактный тест ([test-plan.md](docs/test-plan.md#что-предложил-ai-и-что-пришлось-исправить)).

## Что изменено в проекте по сравнению с практикой 4

- `docs/requirements.md`: добавлен раздел R8 (заявки куратору); в копии проекта, оригинал в practice_04 не тронут.
- Backend: пакет `internal/suggestions`, маршруты `GET|POST /suggestions`, переменная `SUGGESTIONS_DELAY`.
- Frontend: React 19, Tailwind v4, shadcn/ui; `src/App.tsx` (вкладки), `src/features/search/SearchPage.tsx` (поиск переписан на shadcn, 20 старых тестов проходят без изменений), `src/features/suggestions/*` (новая фича), `src/test/*` (подмена сервера, контракт).
