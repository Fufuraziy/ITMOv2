import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarize, judge, anchorPattern } from './gotest-json.mjs'

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}.jsonl`, import.meta.url), 'utf8')

test('summarize: падение на утверждении', () => {
  const s = summarize(fixture('red-assert'))
  assert.equal(s.outcome, 'failed')
  assert.deepEqual(s.failed, ['TestAdd', 'TestAdd/positive'])
  assert.deepEqual(s.passed, ['TestAdd/zero'])
  assert.match(s.failureOutput, /Add\(2, 3\) = -1, want 5/)
})

test('summarize: ошибка компиляции', () => {
  const s = summarize(fixture('build-failed'))
  assert.equal(s.outcome, 'build-failed')
  assert.match(s.buildOutput, /undefined: Div/)
})

test('summarize: panic в тесте', () => {
  const s = summarize(fixture('panic'))
  assert.equal(s.outcome, 'panic')
  assert.deepEqual(s.failed, ['TestDiv'])
})

test('summarize: тесты прошли', () => {
  const s = summarize(fixture('pass'))
  assert.equal(s.outcome, 'passed')
  assert.deepEqual(s.passed, ['TestMul'])
})

test('summarize: шаблон не нашёл тестов', () => {
  assert.equal(summarize(fixture('no-tests')).outcome, 'no-tests')
})

test('judge: red принимает только падение на утверждении', () => {
  const cases = [
    ['red-assert', 'red', true, /RED OK/],
    ['build-failed', 'red', false, /заглушк/],
    ['panic', 'red', false, /panic/],
    ['pass', 'red', false, /уже проходит/],
    ['no-tests', 'red', false, /не нашёл ни одного теста/],
  ]
  for (const [name, phase, ok, msg] of cases) {
    const v = judge(phase, summarize(fixture(name)))
    assert.equal(v.ok, ok, name)
    assert.match(v.message, msg, name)
  }
})

test('judge: green требует зелёного целевого теста и всего модуля', () => {
  const pass = summarize(fixture('pass'))
  assert.equal(judge('green', pass, pass).ok, true)
  assert.match(judge('green', pass, pass).message, /GREEN OK/)

  const regress = judge('green', pass, summarize(fixture('red-assert')))
  assert.equal(regress.ok, false)
  assert.match(regress.message, /регресс/)
  assert.match(regress.message, /TestAdd\/positive/)

  const stillRed = judge('green', summarize(fixture('red-assert')), pass)
  assert.equal(stillRed.ok, false)
  assert.match(stillRed.message, /ещё падает/)

  assert.equal(judge('green', summarize(fixture('no-tests')), pass).ok, false)
})

test('judge: первая строка вердикта перечисляет только тесты верхнего уровня', () => {
  const red = judge('red', summarize(fixture('red-assert'))).message.split('\n')[0]
  assert.equal(red, 'RED OK: падает на проверке поведения (TestAdd; подслучаев: 1).')
  const pass = summarize(fixture('pass'))
  assert.equal(judge('green', pass, pass).message, 'GREEN OK: TestMul проходят; весь модуль зелёный.')
})

test('anchorPattern: имя теста превращается в точный regexp', () => {
  assert.equal(anchorPattern('TestCreate'), '^TestCreate$')
  assert.equal(anchorPattern('TestCreate/empty_title'), '^TestCreate$/^empty_title$')
  assert.equal(anchorPattern('^TestA|TestB$'), '^TestA|TestB$')
})
