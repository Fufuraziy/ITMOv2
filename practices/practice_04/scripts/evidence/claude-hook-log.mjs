#!/usr/bin/env node
// Достаёт из транскрипта сессии Claude Code (~/.claude/projects/<проект>/<id>.jsonl)
// все ответы hook check-after-edit, которые получил агент, и печатает хронологию в markdown.
//   node scripts/evidence/claude-hook-log.mjs <transcript.jsonl> > docs/evidence/02-hook-log.md
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: claude-hook-log.mjs <transcript.jsonl>')
  process.exit(2)
}

const rows = []
for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line.includes('check-after-edit')) continue
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    continue
  }
  const a = entry.attachment
  if (entry.type !== 'attachment' || !a) continue
  let text
  if (a.type === 'hook_blocking_error') text = a.blockingError?.blockingError
  else if (a.type === 'hook_additional_context') text = [].concat(a.content ?? a.additionalContext ?? []).join('\n')
  if (!text || !text.includes('[check-after-edit]')) continue
  rows.push({ time: entry.timestamp, hook: a.hookName, failed: a.type === 'hook_blocking_error', text })
}

console.log('# Hook check-after-edit в реальной работе (сессия Claude Code)\n')
console.log('Каждая строка — ответ hook, который агент получил сразу после своей правки Edit/Write.')
console.log(`Источник: транскрипт сессии, извлечено \`scripts/evidence/claude-hook-log.mjs\`. Всего: ${rows.length}, ` +
  `FAIL: ${rows.filter((r) => r.failed).length}, PASS: ${rows.filter((r) => !r.failed).length}.\n`)
console.log('| время (UTC) | событие | файл → область | итог | ключевые строки |')
console.log('|---|---|---|---|---|')
for (const r of rows) {
  const lines = r.text.split('\n')
  const head = lines.find((l) => l.includes('[check-after-edit]')).replace(/^.*\[check-after-edit\] /, '')
  const verdict = lines.find((l) => /^CHECK (PASS|FAIL)/.test(l)) ?? (r.failed ? 'FAIL' : 'PASS')
  const keys = lines
    .filter((l) => /^\s+(FAIL|ok)\s|--- FAIL|: undefined|redeclared|want |Error \[|AssertionError|^\s+service_test|^\s+validate_test|^\s+handler_test/.test(l))
    .map((l) => l.trim())
    .filter((l, i, all) => all.indexOf(l) === i)
    .slice(0, 4)
    .join('<br>')
    .replace(/\|/g, '\\|')
  console.log(`| ${r.time.slice(11, 19)} | ${r.hook} | \`${head}\` | ${r.failed ? '❌' : '✅'} ${verdict} | ${keys} |`)
}
