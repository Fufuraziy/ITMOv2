# Подтверждения

| файл | что подтверждает |
|---|---|
| [00-baseline-check.txt](00-baseline-check.txt) | исходное состояние после предыдущего агента: gofmt, `go vet` и сборка тестов падали — код ни разу не запускали |
| [01-check-all.txt](01-check-all.txt) | `sh scripts/check.sh` после ремонта: backend, frontend, mcp, skill, hooks — PASS |
| [02-hook-log.md](02-hook-log.md) | ответы hook `check-after-edit`, которые агент (Claude Code) получал после своих правок: FAIL → исправление → PASS |
| [tdd-journal.md](tdd-journal.md) | журнал skill `tdd-go`: отклонённые red (`BUILD FAILED`, `PANIC`), принятые `RED OK` и `GREEN OK` по трём циклам |
| [03-mcp-demo.txt](03-mcp-demo.txt) | реальные вызовы MCP поиска: `list_tags`, `search_collections`, `get_collection` (успех), пустая выдача, неизвестный id, отказ схемы |
| [04-opencode-check.txt](04-opencode-check.txt) | OpenCode 1.18.34: skill `tdd-go` найден, MCP `vkusvill` и `vv-collections` connected, runner в WSL — PASS |
| [06-catalog-build.txt](06-catalog-build.txt) | сборка каталога через MCP ВкусВилла: по каждой теме — запрос → выбранный товар, цена за шт/кг, количество, ссылка на корзину |
| [07-page.png](07-page.png) | страница поиска (1280 px): поиск-герой, 10 тегов, бюджет, полки с фото и кнопкой корзины |
| [05-agent-demo.md](05-agent-demo.md) | **агентный прогон с нуля** (до разворота сервиса в поиск): новая сессия Claude Code сама загрузила AGENTS.md и skill, вызвала `Skill(tdd-go)`, сделала фичу B (R4) через `RED OK → GREEN OK`, получила 11 ответов hook (8 FAIL), вызвала MCP ВкусВилла и `create_collection` (успех и ошибка) |

Как воспроизвести:

```sh
sh scripts/check.sh                                   # 01
node scripts/evidence/claude-hook-log.mjs <transcript.jsonl> > docs/evidence/02-hook-log.md
sh scripts/dev-backend.sh &                           # бэкенд для MCP
node mcp/vv-collections/demo.mjs > docs/evidence/03-mcp-demo.txt
node mcp/vv-collections/curate.mjs > docs/evidence/06-catalog-build.txt
```

Агентный прогон с нуля — поручение в [../demo-prompt.md](../demo-prompt.md), отчёт:

```sh
f=~/.claude/projects/<проект>/<id сессии>.jsonl
{ node scripts/evidence/claude-session-report.mjs "$f"; node scripts/evidence/claude-hook-log.mjs "$f"; } > docs/evidence/05-agent-demo.md
```
