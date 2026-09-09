# Unit-проверки

| Требование или правило | Что проверяем изолированно | Вход | Ожидаемый результат | Evidence |
|---|---|---|---|---|
| Формирование промпта | ReviewService.review формирует строку промпта с включением diff | diff='X' | Вызов LLM с "Review this pull request and find problems:\nX" | TRAINING_PR.diff app/review_service.py:19-21 |
| Формат ответа | ReviewService.review возвращает dict с ключом comment | mock LLM возвращает 'ok' | {'comment': 'ok'} | TRAINING_PR.diff app/review_service.py:21-22 |
| Валидация входа — обязательность diff | Функция валидации запроса | payload={} | Исключение/результат валидации указывает на отсутствие diff | TO BE из analysis.md |
| Валидация длины | Проверка длины ≤ N | diff длиной N+1 | Исключение/флаг превышения | TO BE из analysis.md |
| Маппинг ошибок LLM | Обработчик исключений переводит ошибки в сервисные коды | Exception() | Классифицированная ошибка (метка для 502/503) | TO BE из analysis.md |

## Как использовали AI

- Строка в [`prompts.md`](prompts.md): P1-02
- Что проверили и исправили сами: сверили формирование промпта/ответа с TRAINING_PR.diff; проверки валидации и маппинга описаны как цели unit-тестов.
