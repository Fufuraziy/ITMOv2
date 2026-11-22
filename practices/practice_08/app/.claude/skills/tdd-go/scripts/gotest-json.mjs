// Разбор вывода `go test -json` и вердикт для фаз red/green.
// Чистые функции без I/O: их проверяет tdd.test.mjs на реальных фикстурах Go.

/**
 * @typedef {'failed'|'panic'|'build-failed'|'passed'|'no-tests'} Outcome
 * @typedef {{outcome: Outcome, passed: string[], failed: string[], failureOutput: string, buildOutput: string}} Summary
 */

/** @returns {Summary} */
export function summarize(jsonl) {
  const final = new Map() // Test -> pass|fail|skip
  const outputByTest = new Map()
  let buildOutput = ''
  let buildFailed = false

  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue
    let ev
    try {
      ev = JSON.parse(line)
    } catch {
      continue
    }
    if (ev.Action === 'build-output') buildOutput += ev.Output ?? ''
    if (ev.Action === 'build-fail' || ev.FailedBuild) buildFailed = true
    if (ev.Action === 'output' && /\[(build|setup) failed\]/.test(ev.Output ?? '')) buildFailed = true
    if (!ev.Test) continue
    if (ev.Action === 'output') {
      outputByTest.set(ev.Test, (outputByTest.get(ev.Test) ?? '') + (ev.Output ?? ''))
    }
    if (ev.Action === 'pass' || ev.Action === 'fail' || ev.Action === 'skip') {
      final.set(ev.Test, ev.Action)
    }
  }

  const byStatus = (status) => [...final].filter(([, a]) => a === status).map(([t]) => t).sort()
  const passed = byStatus('pass')
  const failed = byStatus('fail')
  const failureOutput = failed
    .map((t) => outputByTest.get(t) ?? '')
    .join('')
    .split('\n')
    .filter((l) => l.trim() && !/^\s*=== (RUN|PAUSE|CONT)/.test(l))
    .join('\n')

  /** @type {Outcome} */
  let outcome
  if (buildFailed) outcome = 'build-failed'
  else if (failed.length > 0) outcome = /^panic: /m.test(failureOutput) ? 'panic' : 'failed'
  else if (passed.length > 0) outcome = 'passed'
  else outcome = 'no-tests'

  return { outcome, passed, failed, failureOutput, buildOutput }
}

/**
 * Вердикт по фазе цикла.
 * red: целевой тест обязан упасть на проверке поведения.
 * green: целевой тест проходит, и весь модуль зелёный (нет регрессий).
 * @param {'red'|'green'} phase
 * @param {Summary} target результат прогона целевого теста
 * @param {Summary} [suite] результат прогона всего модуля (для green)
 */
export function judge(phase, target, suite) {
  if (target.outcome === 'no-tests') {
    return { ok: false, message: 'NO TESTS: шаблон -run не нашёл ни одного теста. Проверь имя теста и пакет.' }
  }

  if (phase === 'red') {
    switch (target.outcome) {
      case 'failed':
        return { ok: true, message: `RED OK: падает на проверке поведения (${names(target.failed)}).\n${clip(target.failureOutput)}` }
      case 'build-failed':
        return {
          ok: false,
          message: 'BUILD FAILED: тест не компилируется, значит он ещё ничего не проверяет. ' +
            'Добавь заглушку с нужной сигнатурой (нулевые значения), чтобы тест падал на утверждении.\n' +
            clip(target.buildOutput),
        }
      case 'panic':
        return {
          ok: false,
          message: 'PANIC: тест падает с panic, а не на проверке. Обычно виновата заглушка или фикстура: ' +
            'добейся падения через t.Errorf/t.Fatalf.\n' + clip(target.failureOutput),
        }
      case 'passed':
        return {
          ok: false,
          message: `ALREADY GREEN: тест уже проходит (${names(target.passed)}) — он не описывает новое поведение. ` +
            'Уточни ожидание или выбери другой сценарий.',
        }
    }
  }

  if (target.outcome !== 'passed') {
    return {
      ok: false,
      message: `STILL RED: целевой тест ещё падает (${names(target.failed) || target.outcome}).\n` +
        clip(target.failureOutput || target.buildOutput),
    }
  }
  if (suite && suite.outcome !== 'passed') {
    return {
      ok: false,
      message: `REGRESSION: целевой тест зелёный, но модуль сломан — регресс в ${suite.failed.join(', ') || suite.outcome}.\n` +
        clip(suite.failureOutput || suite.buildOutput),
    }
  }
  return { ok: true, message: `GREEN OK: ${names(target.passed)} проходят; весь модуль зелёный.` }
}

/** Имя теста (TestX или TestX/sub) превращает в точный шаблон для go test -run. */
export function anchorPattern(name) {
  if (/^[\w/]+$/.test(name)) {
    return name.split('/').map((part) => `^${part}$`).join('/')
  }
  return name
}

/** Тесты верхнего уровня и число подслучаев: «TestA, TestB; подслучаев: 12». */
function names(tests) {
  const top = tests.filter((t) => !t.includes('/'))
  const subs = tests.length - top.length
  return top.join(', ') + (subs > 0 ? `; подслучаев: ${subs}` : '')
}

function clip(text, max = 30) {
  const lines = text.trim().split('\n')
  return lines.length > max ? [...lines.slice(0, max), `… ещё ${lines.length - max} строк`].join('\n') : lines.join('\n')
}
