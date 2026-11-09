import { describe, expect, it } from 'vitest'
import { readVariants } from './servings'
import { dinner, withVariants } from './ui/fixtures'

describe('readVariants', () => {
  it('returns three variants ordered ×1, ×2, ×4', () => {
    expect(readVariants(dinner)?.map((v) => v.multiplier)).toEqual([1, 2, 4])
  })

  it('orders variants by multiplier even if the response does not', () => {
    const shuffled = withVariants(dinner, ([a, b, c]) => [c, a, b])
    expect(readVariants(shuffled)?.map((v) => v.cart_url)).toEqual([
      'https://vkusvill.ru/?share_basket=1001',
      'https://vkusvill.ru/?share_basket=1002',
      'https://vkusvill.ru/?share_basket=1004',
    ])
  })

  it.each([
    ['there are no variants (old backend)', { ...dinner, variants: undefined }],
    ['there are two variants', withVariants(dinner, (v) => v.slice(0, 2))],
    ['there are four variants', withVariants(dinner, (v) => [...v, v[2]])],
    ['multipliers are not 1, 2, 4', withVariants(dinner, (v) => [v[0], v[1], { ...v[1] }])],
    ['a cart link is empty', withVariants(dinner, (v) => [v[0], { ...v[1], cart_url: '' }, v[2]])],
    ['a cart link is missing', withVariants(dinner, (v) => [v[0], { ...v[1], cart_url: null as unknown as string }, v[2]])],
    ['a total is not a number', withVariants(dinner, (v) => [v[0], v[1], { ...v[2], total_price: '1998' as unknown as number }])],
    ['a product has no quantity', withVariants(dinner, (v) => {
      delete v[1].quantities['5005']
      return v
    })],
  ])('returns null when %s', (_, c) => {
    expect(readVariants(c)).toBeNull()
  })
})
