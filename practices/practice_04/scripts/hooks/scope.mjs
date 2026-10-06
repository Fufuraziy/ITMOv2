// Определяет, какую область scripts/check.sh запускать после правки файла.
// Общий модуль для hook Claude Code и плагина OpenCode.
import path from 'node:path'

const RULES = [
  { scope: 'backend', dir: 'backend/', match: (rel) => /\.go$|(^|\/)go\.(mod|sum)$|^backend\/catalog\/.+\.json$/.test(rel) },
  { scope: 'frontend', dir: 'frontend/', match: (rel) => /\.(tsx?|json|html)$/.test(rel) },
  { scope: 'mcp', dir: 'mcp/vv-collections/', match: (rel) => /\.(m?js|json)$/.test(rel) },
  { scope: 'skill', dir: '.claude/skills/tdd-go/scripts/', match: (rel) => /\.m?js$/.test(rel) },
  { scope: 'hooks', dir: 'scripts/hooks/', match: (rel) => /\.m?js$/.test(rel) },
]

function normalize(p) {
  return p.replace(/\\/g, '/').replace(/^([a-z]):/i, (_, d) => d.toLowerCase() + ':')
}

/**
 * @param {string | undefined} file путь к изменённому файлу (абсолютный или от корня)
 * @param {string} root корень репозитория
 * @returns {'backend'|'frontend'|'mcp'|'skill'|'hooks'|null}
 */
export function scopeFor(file, root) {
  if (!file) return null
  const f = normalize(file)
  const r = normalize(root).replace(/\/$/, '')
  let rel
  if (path.posix.isAbsolute(f) || /^[a-z]:\//.test(f)) {
    if (!f.startsWith(r + '/')) return null
    rel = f.slice(r.length + 1)
  } else {
    rel = f.replace(/^\.\//, '')
  }
  for (const rule of RULES) {
    if (rel.startsWith(rule.dir) && rule.match(rel)) return rule.scope
  }
  return null
}
