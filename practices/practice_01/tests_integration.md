# Integration-проверки

| Связь компонентов | Что может сломаться | Как воспроизводим | Ожидаемый результат | Evidence |
|---|---|---|---|---|
| FastAPI эндпоинт ↔ ReviewService | Отсутствует ключ diff → 500 в AS IS | Тестовый клиент POST `{}` | 400 (TO BE) | TRAINING_PR.diff app/api.py:35-38; analysis.md |
| ReviewService ↔ LLM | Исключение из LLM | LLM mock кидает Exception | 502/503 (TO BE) | TRAINING_PR.diff app/review_service.py:21; analysis.md |
| Эндпоинт ↔ лимитатор | Слишком большой diff | Сформировать diff длиной N+1 | 413 (TO BE) | analysis.md |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-02
- Что проверили и исправили сами: определили интеграционные швы по файлам diff; оставили проверяемые статусы как цель.
