import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scopeFor } from './scope.mjs'

const root = 'C:\\proj'

test('scopeFor maps edited files to check scopes', () => {
  const cases = [
    ['C:\\proj\\backend\\internal\\collections\\service.go', 'backend'],
    ['C:/proj/backend/go.mod', 'backend'],
    ['backend/cmd/api/main_test.go', 'backend'],
    ['backend/catalog/collections.json', 'backend'],
    ['C:\\proj\\frontend\\src\\ui\\App.tsx', 'frontend'],
    ['frontend/vite.config.ts', 'frontend'],
    ['frontend/package.json', 'frontend'],
    ['C:\\proj\\mcp\\vv-collections\\server.js', 'mcp'],
    ['mcp/vv-collections/server.test.js', 'mcp'],
    ['.claude/skills/tdd-go/scripts/tdd.mjs', 'skill'],
    ['scripts/hooks/scope.mjs', 'hooks'],
  ]
  for (const [file, want] of cases) {
    assert.equal(scopeFor(file, root), want, file)
  }
})

test('scopeFor ignores files without automated checks', () => {
  for (const file of [
    'C:\\proj\\README.md',
    'backend/README.md',
    'docs/requirements.md',
    '.claude/skills/tdd-go/SKILL.md',
    'C:\\other\\backend\\x.go',
    '',
    undefined,
  ]) {
    assert.equal(scopeFor(file, root), null, String(file))
  }
})
