#!/usr/bin/env node
// PostToolUse-hook Claude Code: после Edit/Write запускает scripts/check.sh для
// затронутой области и возвращает результат агенту.
//   PASS -> exit 0 + JSON additionalContext (агент видит краткий итог);
//   FAIL -> exit 2 + stderr (Claude Code передаёт вывод агенту как ошибку).
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scopeFor } from './scope.mjs'

const root = process.env.CLAUDE_PROJECT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

let raw = ''
for await (const chunk of process.stdin) raw += chunk

let event
try {
  event = JSON.parse(raw)
} catch {
  process.exit(0) // не наш формат события, не мешаем работе
}

const file = event?.tool_input?.file_path ?? event?.tool_input?.notebook_path
const scope = scopeFor(file, root)
if (!scope) process.exit(0)

const run = spawnSync('bash', [path.join(root, 'scripts', 'check.sh'), scope], {
  cwd: root,
  encoding: 'utf8',
  timeout: 170_000,
})
const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim()
const rel = path.relative(root, file).replace(/\\/g, '/')
const header = `[check-after-edit] ${rel} -> sh scripts/check.sh ${scope}`

if (run.status === 0) {
  const summary = output.split('\n').filter((l) => /^\s+ok\s|^CHECK/.test(l)).join('\n')
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `${header}\n${summary}`,
    },
  }))
  process.exit(0)
}

const reason = run.error ? `runner не запустился: ${run.error.message}` : output
process.stderr.write(`${header}\n${reason}\nИсправь причину и повтори правку; не ослабляй проверку.\n`)
process.exit(2)
