# Демо-поручение для новой сессии агента

Открыть **новую** сессию Claude Code (или OpenCode) в корне проекта, чтобы агент загрузил правила, skills, MCP и hook с нуля, и отправить сообщение ниже. Первый прогон (фича R4) — [evidence/05-agent-demo.md](evidence/05-agent-demo.md).

```text
Работай по AGENTS.md.

1. Прочитай AGENTS.md и docs/requirements.md. Назови команду проверки, контракт R6 и что тебе запрещено.
2. Загрузи skill tdd-go и прочитай его references/writing-good-tests.md.
3. Реализуй R6 (исключение слов в поиске) строго по skill: тест → заглушка → tdd.mjs red (RED OK) →
   реализация → tdd.mjs green (GREEN OK). Если hook после правки вернёт FAIL — исправь причину.
4. Запусти бэкенд в фоне: sh scripts/dev-backend.sh (если порт 8080 занят — спроси меня).
5. Через MCP vv-collections найди подборку на завтрак без сырников (search_collections с query
   «завтрак -сырники»), покажи её состав (get_collection) и ссылку на корзину. Затем вызови
   get_collection с несуществующим id и search_collections с max_price = -1 и покажи ошибки.
6. Запусти sh scripts/check.sh.
7. Отчёт: какие правила AGENTS.md применил, строки docs/evidence/tdd-journal.md, ответы hook,
   результаты MCP-вызовов. Commit не делай.
```

| элемент среды | признак применения |
|---|---|
| `AGENTS.md` | агент называет `sh scripts/check.sh`, R6 и запреты, не трогает `scripts/check.sh` |
| skill `tdd-go` | вызов skill, чтение `writing-good-tests.md`, вердикты `RED OK` → `GREEN OK`, новые строки журнала |
| hook | после правок приходит `[check-after-edit] … CHECK FAIL/PASS` без запроса агента |
| MCP | `search_collections` с исключением, `get_collection` (успех и ошибка), отказ схемы на `max_price = -1` |
