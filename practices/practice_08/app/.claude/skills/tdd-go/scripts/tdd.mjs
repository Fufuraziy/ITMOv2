#!/usr/bin/env node
// Контроль цикла TDD для Go-бэкенда.
//
//   node .claude/skills/tdd-go/scripts/tdd.mjs red   TestName [--pkg ./internal/collections]
//   node .claude/skills/tdd-go/scripts/tdd.mjs green TestName [--pkg ./internal/collections]
//
// red   — целевой тест должен упасть на утверждении (не на компиляции, не panic, не «уже зелёный»).
// green — целевой тест проходит, и весь модуль backend зелёный.
// Каждый вызов дописывает строку в docs/evidence/tdd-journal.md (отключается --no-journal).
// Код выхода: 0 — фаза подтверждена, 1 — нет, 2 — ошибка запуска.
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { anchorPattern, judge, summarize } from './gotest-json.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const JOURNAL = path.join(ROOT, 'docs', 'evidence', 'tdd-journal.md')

function usage(msg) {
  if (msg) console.error(msg)
  console.error('usage: tdd.mjs <red|green> <TestName|regexp> [--pkg ./...] [--no-journal]')
  process.exit(2)
}

const args = process.argv.slice(2)
const phase = args[0]
const name = args[1]
if (phase !== 'red' && phase !== 'green') usage(`неизвестная фаза: ${phase ?? '(нет)'}`)
if (!name || name.startsWith('--')) usage('не указан тест')
const pkgIdx = args.indexOf('--pkg')
const pkg = pkgIdx > 0 ? args[pkgIdx + 1] : './...'
if (!pkg) usage('после --pkg нужен путь пакета')
const journal = !args.includes('--no-journal')

function goTestJSON(runPattern, target) {
  const script = '. scripts/env.sh && cd backend && go test -json -count=1 ${1:+-run "$1"} "$2"'
  const res = spawnSync('bash', ['-c', script, 'tdd', runPattern ?? '', target], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (res.error) {
    console.error(`не удалось запустить go test: ${res.error.message}`)
    process.exit(2)
  }
  if (!res.stdout.trim() && res.status !== 0) {
    console.error(`go test завершился с кодом ${res.status}:\n${res.stderr}`)
    process.exit(2)
  }
  return summarize(res.stdout)
}

const pattern = anchorPattern(name)
console.log(`$ go test -json -count=1 -run '${pattern}' ${pkg}   (в backend/)`)
const target = goTestJSON(pattern, pkg)
let suite
if (phase === 'green' && target.outcome === 'passed') {
  console.log('$ go test -json -count=1 ./...   (весь модуль, поиск регрессий)')
  suite = goTestJSON(null, './...')
}
const verdict = judge(phase, target, suite)
console.log(verdict.message)

if (journal) {
  if (!existsSync(JOURNAL)) {
    mkdirSync(path.dirname(JOURNAL), { recursive: true })
    writeFileSync(JOURNAL, '# Журнал TDD (пишет .claude/skills/tdd-go/scripts/tdd.mjs)\n\n' +
      '| время | фаза | тест | пакет | вердикт |\n|---|---|---|---|---|\n')
  }
  const when = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const cell = (s) => s.replace(/\|/g, '\\|')
  const head = cell(verdict.message.split('\n')[0])
  appendFileSync(JOURNAL, `| ${when} | ${phase} | \`${cell(name)}\` | \`${pkg}\` | ${verdict.ok ? '✅' : '❌'} ${head} |\n`)
}

process.exit(verdict.ok ? 0 : 1)
