Настройка OpenCode для проекта VV Collections (проверено на opencode 1.18.34).

- Правила: `AGENTS.md` в корне (OpenCode читает его сам) + `docs/style-guide.md` через `instructions` в `opencode.json`.
- Skill: `.claude/skills/tdd-go/` — OpenCode находит skills по Claude-совместимому пути, Claude Code — по своему; одна копия на оба агента.
- MCP: `opencode.json` в корне — `vkusvill` (remote) и `vv-collections` (local, `node mcp/vv-collections/server.js`).
- Hook: `plugins/check-after-edit.js` — после edit/write запускает `scripts/check.sh` и дописывает результат в вывод инструмента.

`package.json`, `package-lock.json`, `.gitignore` и `node_modules/` здесь создаёт сам OpenCode для типов `@opencode-ai/plugin`.
