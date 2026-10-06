// Плагин OpenCode (API плагинов v1, проверено на opencode 1.18.34):
// после edit/write/apply_patch запускает scripts/check.sh для затронутой области
// и дописывает результат в вывод инструмента — так его видит агент.
// Логика выбора области общая с hook Claude Code: scripts/hooks/scope.mjs.
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { scopeFor } from '../../scripts/hooks/scope.mjs'

const EDIT_TOOLS = new Set(['edit', 'write', 'multiedit', 'patch', 'apply_patch'])

function editedFiles(args = {}) {
  const direct = [args.filePath, args.file_path].filter(Boolean)
  const patch = String(args.patchText ?? args.patch ?? '')
  const fromPatch = [...patch.matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm)].map((m) => m[1].trim())
  return [...direct, ...fromPatch]
}

export const CheckAfterEdit = async ({ directory, worktree }) => {
  const root = worktree || directory
  return {
    'tool.execute.after': async (input, output) => {
      if (!EDIT_TOOLS.has(input.tool)) return
      const scopes = [...new Set(editedFiles(input.args).map((f) => scopeFor(path.resolve(root, f), root)).filter(Boolean))]
      if (scopes.length === 0) return

      const run = spawnSync('bash', [path.join(root, 'scripts', 'check.sh'), ...scopes], {
        cwd: root,
        encoding: 'utf8',
        timeout: 170_000,
      })
      const result = run.error ? `runner не запустился: ${run.error.message}` : `${run.stdout}${run.stderr}`.trim()
      const verdict = run.status === 0 ? 'PASS' : 'FAIL — исправь причину и повтори правку; не ослабляй проверку'
      output.output = `${output.output ?? ''}\n\n[check-after-edit] sh scripts/check.sh ${scopes.join(' ')}: ${verdict}\n${result}`
    },
  }
}
