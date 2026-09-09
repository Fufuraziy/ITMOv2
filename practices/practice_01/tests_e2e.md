# E2E-проверки

| Сценарий пользователя | Предусловия | Действие | Наблюдаемый результат | Evidence |
|---|---|---|---|---|
| Позитивный | Развёрнуто API, доступен LLM/mock | POST /api/reviews с валидным `{diff}` | 200 OK и тело `{comment: string}` | TRAINING_PR.diff app/review_service.py:19-22; analysis.md |
| Негативный | Развёрнуто API | POST /api/reviews с `{}` | 400 Bad Request | app/api.py:35-38; analysis.md |
| Граничный | Настроен лимит N | POST /api/reviews с diff длиной N+1 | 413 Payload Too Large | analysis.md |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-02
- Что проверили и исправили сами: связали сценарии с конкретными строками diff и целевыми кодами статусов.
