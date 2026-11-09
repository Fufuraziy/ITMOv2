import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cartProducts, checkItem, cleanName, pickItem, scaleQuantity, SEARCH_FIELDS, SERVINGS, toProduct } from './curate.mjs'

test('cleanName: убирает &nbsp;, неразрывные пробелы и сущности', () => {
  assert.equal(cleanName('Сметана 15%, 250&nbsp;г'), 'Сметана 15%, 250 г')
  assert.equal(cleanName('Чай "Цейлонский"  '), 'Чай "Цейлонский"')
  assert.equal(cleanName('Сыр &quot;Гауда&quot; &amp; мёд'), 'Сыр "Гауда" & мёд')
})

test('pickItem: первый товар с ценой, в названии которого есть pick', () => {
  const items = [
    { name: 'Чипсы со вкусом "Сырный соус"', price: { current: 150 } },
    { name: 'Мёд цветочный', price: { current: 0 } },
    { name: 'Мед гречишный', price: { current: 300 } },
    { name: 'Мёд липовый', price: { current: 320 } },
  ]
  assert.equal(pickItem(items, 'мед').name, 'Мед гречишный', 'ё = е, товары без цены пропускаются')
  assert.equal(pickItem(items, 'МЁД ЛИП').name, 'Мёд липовый')
  assert.equal(pickItem(items, '').name, 'Чипсы со вкусом "Сырный соус"', 'пустой pick — первый с ценой')
  assert.equal(pickItem(items, 'сальса'), undefined)
})

test('SERVINGS: множители порций 1, 2, 4 (R7)', () => {
  assert.deepEqual(SERVINGS, [1, 2, 4])
})

test('scaleQuantity: умножает и округляет до 0.01, немасштабируемые не трогает', () => {
  assert.equal(scaleQuantity({ quantity: 0.3 }, 4), 1.2, 'без двоичного хвоста 1.2000000000000002')
  assert.equal(scaleQuantity({ quantity: 0.5 }, 2), 1)
  assert.equal(scaleQuantity({ quantity: 1 }, 1), 1)
  assert.equal(scaleQuantity({ quantity: 2, scalable: false }, 4), 2)
})

test('cartProducts: состав корзины для множителя в формате vkusvill_cart_link_create {id, q}', () => {
  const products = [
    { xml_id: 1, quantity: 0.5 },
    { xml_id: 2, quantity: 1, scalable: false },
  ]
  assert.deepEqual(cartProducts(products, 2), [{ id: 1, q: 1 }, { id: 2, q: 1 }])
  assert.deepEqual(cartProducts(products, 4), [{ id: 1, q: 2 }, { id: 2, q: 1 }])
})

test('checkItem: масштабируемый товар не больше 10, иначе ×4 больше лимита корзины 40', () => {
  assert.match(checkItem({ q: 'сырок', quantity: 15 }), /больше 10/)
  assert.equal(checkItem({ q: 'сырок', quantity: 15, scalable: false }), null)
  assert.equal(checkItem({ q: 'сырок', quantity: 10 }), null)
  assert.equal(checkItem({ q: 'сырок' }), null, 'без quantity — 1')
})

test('SEARCH_FIELDS: только поля, которые принимает vkusvill_products_search', () => {
  assert.ok(SEARCH_FIELDS.includes('id'), 'xml_id товара приходит в поле id')
  assert.ok(!SEARCH_FIELDS.includes('xml_id'), 'поле xml_id API больше не принимает')
})

test('toProduct: товар каталога из ответа поиска, id ВкусВилла — это xml_id', () => {
  const found = {
    id: 14526,
    name: 'Сметана 15%,&nbsp;250 г',
    price: { current: 97.6 },
    unit: 'шт',
    rating: { average: 4.86 },
    url: 'https://vkusvill.ru/goods/smetana-15-14526/',
    images: [{ medium: 'https://img.vkusvill.ru/a.webp' }],
  }
  assert.deepEqual(toProduct(found, { q: 'сметана', quantity: 2, scalable: false }), {
    xml_id: 14526,
    name: 'Сметана 15%, 250 г',
    quantity: 2,
    unit: 'шт',
    price: 98,
    url: 'https://vkusvill.ru/goods/smetana-15-14526/',
    image: 'https://img.vkusvill.ru/a.webp',
    rating: 4.9,
    scalable: false,
  })
  assert.equal(toProduct(found, { q: 'сметана' }).quantity, 1)
  assert.equal('scalable' in toProduct(found, { q: 'сметана' }), false, 'scalable пишется только при false')
})
