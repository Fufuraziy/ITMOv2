import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanName, pickItem } from './curate.mjs'

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
