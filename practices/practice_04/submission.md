# Практика 4: среда агента, skill, MCP

Проект — сервис поиска готовых подборок продуктов ВкусВилла с кнопкой «в корзину ВкусВилла». Go + React, агент — Claude Code (конфиг для OpenCode тоже есть).

## 1. Среда (5 б)

| | файлы | зачем | подтверждение |
|---|---|---|---|
| AGENTS.md | [AGENTS.md](AGENTS.md), [requirements](docs/requirements.md), [style guide](docs/style-guide.md) | контракт, команда проверки, запреты | [05-agent-demo](docs/evidence/05-agent-demo.md) |
| Skill | [tdd-go](.claude/skills/tdd-go/SKILL.md) | доказать red→green запуском, а не словами | [05-agent-demo](docs/evidence/05-agent-demo.md) (вызов `Skill(tdd-go)`) |
| MCP | [.mcp.json](.mcp.json), [opencode.json](opencode.json) | `vkusvill` — реальные товары; `vv-collections` — поиск подборок | [05-agent-demo](docs/evidence/05-agent-demo.md), [04-opencode-check](docs/evidence/04-opencode-check.txt) |
| Hook | [.claude/settings.json](.claude/settings.json) → [check-after-edit.mjs](scripts/hooks/check-after-edit.mjs), runner [check.sh](scripts/check.sh) | проверка за секунды после каждой правки, результат уходит агенту | [02-hook-log](docs/evidence/02-hook-log.md): 58 ответов, 38 FAIL → исправлено |

## 2. Skill tdd-go (2 б)

[tdd.mjs](.claude/skills/tdd-go/scripts/tdd.mjs) запускает `go test -json`. Фазу red он принимает только при падении на утверждении (отклоняет `BUILD FAILED`, `PANIC`, `ALREADY GREEN`). Фазу green — только когда весь модуль зелёный. Каждый вызов пишет строку в журнал.

Результат — [tdd-journal.md](docs/evidence/tdd-journal.md).

## 3. Свой MCP vv-collections (2 б)

[server.js](mcp/vv-collections/server.js): `search_collections`, `get_collection`, `list_tags`. Отдаёт состав подборки и ссылку на корзину ВкусВилла.

Вызовы — [03-mcp-demo.txt](docs/evidence/03-mcp-demo.txt):
- успешный поиск и состав подборки;
- неизвестный id → `Подборки «pizza-margarita» нет`;
- `max_price: -100` → `Input validation error`.

## 4. Рефлексия (1 б)

[reflection.md](reflection.md)
