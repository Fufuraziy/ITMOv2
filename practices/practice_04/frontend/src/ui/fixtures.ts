// Тестовые подборки с вариантами порций (specs/002-servings-logic/contracts/http-api.md).
import type { Collection, Variant } from '../api'

const product = (xml_id: number, name: string, quantity: number, unit: string, price: number, scalable: boolean) => ({
  xml_id, name, quantity, base_quantity: quantity, scalable, unit, price, rating: 4.8,
  url: `https://vkusvill.ru/goods/item-${xml_id}/`, image: `https://img.vkusvill.ru/${xml_id}.webp`,
})

const basket = (n: number) => `https://vkusvill.ru/?share_basket=${n}`

// ×1 = 306 + 0,5 × 54 + 666 = 999; кофе не масштабируется, поэтому ×2 ≠ 2 × 999.
export const dinner: Collection = {
  id: 'uzhin-na-kompaniyu',
  title: 'Ужин на компанию',
  description: 'Сырники, лук и кофе',
  tags: ['ужин'],
  cart_url: basket(1001),
  total_price: 999,
  products: [
    product(114976, 'Сырники классические жареные', 1, 'шт', 306, true),
    product(3001, 'Лук репчатый', 0.5, 'кг', 54, true),
    product(5005, 'Кофе молотый', 1, 'шт', 666, false),
  ],
  variants: [
    { multiplier: 1, total_price: 999, quantities: { '114976': 1, '3001': 0.5, '5005': 1 }, cart_url: basket(1001), available: true },
    { multiplier: 2, total_price: 1332, quantities: { '114976': 2, '3001': 1, '5005': 1 }, cart_url: basket(1002), available: true },
    { multiplier: 4, total_price: 1998, quantities: { '114976': 4, '3001': 2, '5005': 1 }, cart_url: basket(1004), available: true },
  ],
}

export const soup: Collection = {
  ...dinner,
  id: 'sup-na-nedelyu',
  title: 'Суп на неделю',
  cart_url: basket(2001),
  variants: dinner.variants!.map((v) => ({ ...v, cart_url: basket(2000 + v.multiplier) })),
}

/** Копия подборки с изменёнными вариантами: patch получает исходные и возвращает новые. */
export function withVariants(c: Collection, patch: (variants: Variant[]) => Variant[]): Collection {
  return { ...c, variants: patch(c.variants!.map((v) => ({ ...v, quantities: { ...v.quantities } }))) }
}
