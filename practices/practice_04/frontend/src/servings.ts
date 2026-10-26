// Варианты порций подборки из ответа API (specs/001-servings-ui, research R-4).
import type { Collection, Multiplier, Variant } from './api'

export const MULTIPLIERS: readonly Multiplier[] = [1, 2, 4]

/**
 * Три варианта ×1, ×2, ×4 по порядку или null, если бэкенд их не прислал или прислал неполными:
 * тогда карточка остаётся как до фичи, а не обещает корзину, которой нет.
 */
export function readVariants(c: Collection): Variant[] | null {
  const variants = c.variants
  if (!Array.isArray(variants) || variants.length !== MULTIPLIERS.length) return null

  const ordered = MULTIPLIERS.map((m) => variants.find((v) => v?.multiplier === m))
  const complete = ordered.every((v) =>
    v !== undefined &&
    typeof v.cart_url === 'string' && v.cart_url !== '' &&
    typeof v.total_price === 'number' &&
    v.quantities !== null && typeof v.quantities === 'object' &&
    c.products.every((p) => typeof v.quantities[String(p.xml_id)] === 'number'))

  return complete ? (ordered as Variant[]) : null
}
