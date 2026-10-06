#!/usr/bin/env node
// Отчёт о сессии Claude Code по её транскрипту: что загрузилось при старте
// (AGENTS.md, skills, MCP) и хронология вызовов инструментов с краткими результатами.
//   node scripts/evidence/claude-session-report.mjs <transcript.jsonl> > docs/evidence/05-agent-demo.md
import { readFileSync } from 'node:fs'
import path from 'node:path'

const file = process.argv[2]
if (!file) {
  console.error('usage: claude-session-report.mjs <transcript.jsonl>')
  process.exit(2)
}

const entries = readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
  try { return [JSON.parse(l)] } catch { return [] }
})

const results = new Map()
for (const e of entries) {
  const content = e.message?.content
  if (e.type !== 'user' || !Array.isArray(content)) continue
  for (const b of content) {
    if (b.type !== 'tool_result') continue
    const text = typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => c.text ?? '').join('\n')
    results.set(b.tool_use_id, { text, isError: b.is_error === true })
  }
}

const cell = (s, max) => {
  const one = String(s).replace(/\r/g, '').replace(/\n+/g, ' ⏎ ').replace(/\|/g, '\\|').trim()
  return one.length > max ? one.slice(0, max) + ' …' : one
}

const att = (type) => entries.filter((e) => e.attachment?.type === type).map((e) => e.attachment)
const instructions = att('instructions').flatMap((a) => a.files ?? []).map((f) => path.basename(f.path))
const skills = att('skill_listing').map((a) => a.content).join('\n')
const mcpAdded = att('mcp_instructions_delta').flatMap((a) => a.addedNames ?? [])
const toolUses = entries.filter((e) => e.type === 'assistant' && Array.isArray(e.message?.content))
  .flatMap((e) => e.message.content.filter((b) => b.type === 'tool_use').map((b) => ({ ...b, time: e.timestamp })))
const mcpTools = [...new Set(toolUses.map((t) => t.name).filter((n) => /^mcp__(vkusvill|vv-collections)__/.test(n)))]
const first = entries.find((e) => e.timestamp)?.timestamp ?? ''

console.log(`# Агентный прогон с нуля: новая сессия Claude Code\n`)
console.log(`Сессия \`${path.basename(file, '.jsonl')}\`, начало ${first.replace('T', ' ').slice(0, 19)} UTC. ` +
  'Поручение — [docs/demo-prompt.md](../demo-prompt.md). Извлечено `scripts/evidence/claude-session-report.mjs`.\n')
console.log('## Что сессия загрузила сама\n')
console.log('| элемент среды | признак в транскрипте |\n|---|---|')
console.log(`| AGENTS.md | вложение \`instructions\`: ${instructions.map((f) => `\`${f}\``).join(', ') || '—'} |`)
console.log(`| skill tdd-go | \`skill_listing\` ${/^- tdd-go:/m.test(skills) ? 'содержит tdd-go' : 'без tdd-go'}; вызовов Skill: ${toolUses.filter((t) => t.name === 'Skill').map((t) => `\`${t.input.skill}\``).join(', ') || '—'} |`)
console.log(`| MCP | инструкции сервера получены от: ${mcpAdded.filter((n) => /vkusvill|vv-collections/.test(n)).map((n) => `\`${n}\``).join(', ') || '—'}; вызваны: ${mcpTools.map((n) => `\`${n}\``).join(', ')} |`)
const hooks = entries.filter((e) => ['hook_blocking_error', 'hook_additional_context'].includes(e.attachment?.type))
console.log(`| hook | ответов check-after-edit: ${hooks.length} (FAIL: ${hooks.filter((e) => e.attachment.type === 'hook_blocking_error').length}) — см. ниже |\n`)

console.log('## Хронология вызовов\n')
console.log('| время (UTC) | инструмент | вход | результат |\n|---|---|---|---|')
for (const t of toolUses) {
  if (t.name === 'ToolSearch') continue
  const input = t.name === 'Bash' || t.name === 'PowerShell' ? t.input.command
    : t.name === 'Edit' || t.name === 'Write' ? path.basename(t.input.file_path ?? '')
      : JSON.stringify(t.input)
  const r = results.get(t.id)
  const isMcp = t.name.startsWith('mcp__vv-collections') || /tdd\.mjs|check\.sh|curl/.test(input)
  const res = r ? `${r.isError ? '❌ ' : ''}${cell(r.text, isMcp ? 420 : 160)}` : '—'
  console.log(`| ${t.time.slice(11, 19)} | \`${t.name}\` | ${cell(input, 180)} | ${res} |`)
}
