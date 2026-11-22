# Подборки ВкусВилла

Публичный каталог готовых продуктовых наборов под повод и бюджет («Завтрак с сырниками», «Борщ на большую кастрюлю»): подборку можно найти и одной кнопкой перенести в корзину ВкусВилла. В практике 8 добавлен раздел **«Заявки куратору»**. Посетитель, который не нашёл подходящую подборку, отправляет куратору заявку и сразу видит её в списке.

- **Backend**: Go 1.22+, только стандартная библиотека (`backend/`). Контракт: [docs/requirements.md](docs/requirements.md), заявки описаны в разделе R8.
- **Frontend**: React 19 + TypeScript + Vite (`frontend/`).
- **Библиотека компонентов: [shadcn/ui](https://ui.shadcn.com)** (стиль `radix-nova`, примитивы Radix UI) + Tailwind CSS v4. Компоненты лежат в [`frontend/src/components/ui/`](frontend/src/components/ui/): Button, Input, Textarea, NativeSelect, Field, Dialog, Card, Badge, Alert, Skeleton, Tabs, Toggle, Spinner, Sonner (уведомления).
- **Тема** (цвета, шрифт, радиусы, фокус) задана в одном месте: CSS-переменные в [`frontend/src/index.css`](frontend/src/index.css). Компоненты берут их через утилиты `bg-primary`, `text-muted-foreground`, `ring-ring` и т.д. Отступы задаёт шкала Tailwind (`gap-2/4/6/8`, `p-4/6`), шрифт Onest подключается в `index.html`.
- **Макет**: v0 (Vercel), см. [`../mockup/`](../mockup/).

## Установка

Нужны Node.js 20+ (проверено на 24.11) и Go 1.22+. Если Go не установлен, `bash scripts/bootstrap-go.sh` положит портативный в `.tools/`.

```sh
cd frontend && npm ci          # зависимости фронтенда
cd ../mcp/vv-collections && npm ci   # нужны только для проверки MCP в scripts/check.sh
```

Секретов и переменных окружения для запуска не требуется.

## Запуск

```sh
bash scripts/dev.sh            # бэкенд 127.0.0.1:8080 + страница http://localhost:5173
```

Или по отдельности:

```sh
sh scripts/dev-backend.sh                                   # API на 127.0.0.1:8080
cd frontend && npx vite --host 127.0.0.1                    # страница, /collections /tags /suggestions проксируются на :8080
```

Чтобы показать состояние «Отправляем…» на настоящем API, у бэкенда есть задержка ответа на `POST /suggestions`:

```sh
SUGGESTIONS_DELAY=1500ms sh scripts/dev-backend.sh
```

Раздел заявок открывается вкладкой «Заявки куратору» или по ссылке `http://localhost:5173/#suggestions`. Заявки хранятся в памяти процесса и пропадают после перезапуска бэкенда.

## Тесты

```sh
cd frontend && npm test        # клиентские тесты: Vitest + Testing Library + user-event, jsdom
cd frontend && npm run typecheck
sh scripts/check.sh            # всё: gofmt, go vet, go test, tsc, vitest, MCP, skill, hooks
sh scripts/check.sh frontend   # только фронтенд
```

Как устроены клиентские тесты: ответы сервера подменяются в [`src/test/server.ts`](frontend/src/test/server.ts), форма этих ответов сверяется с записанными ответами живого API в [`src/test/contract.test.ts`](frontend/src/test/contract.test.ts). Карта «тест → действие пользователя → ожидаемый результат» лежит в [`../docs/test-plan.md`](../docs/test-plan.md).

## API заявок (R8)

| Запрос | Ответ |
|---|---|
| `GET /suggestions` | `200 {"total", "suggestions": [...]}`, новые сначала |
| `POST /suggestions` `{"title","occasion","budget","comment","email"}` | `201` заявка (без email) |
| ошибки полей | `400 {"code":"invalid_suggestion","fields":{"title":"too_short",...}}` |
| дубль названия | `409 {"code":"duplicate_suggestion","fields":{"title":"duplicate"}}` |
| не JSON | `400 {"code":"invalid_body"}` |
