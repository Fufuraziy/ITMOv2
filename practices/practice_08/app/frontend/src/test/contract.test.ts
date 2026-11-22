// Подменённые ответы сервера должны совпадать по форме с настоящими ответами Go-бэкенда,
// иначе тесты UI могли бы проходить при сломанной интеграции. Образцы — api-samples.json (записаны с живого API).
import { describe, expect, it } from 'vitest'
import samples from './api-samples.json'
import { created, duplicate, invalid, list, suggestion } from './server'

/** Форма значения: ключи объектов и типы листьев, без конкретных данных. */
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.length ? [shape(v[0])] : []
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])]))
  }
  return typeof v
}

describe('Тестовые ответы сервера совпадают с реальным API', () => {
  it('201 POST /suggestions', () => {
    const mock = created({ title: 'Ужин на двоих', occasion: 'ужин', budget: 1500, comment: 'паста', email: 'anna@example.ru' })
    expect(mock.status).toBe(samples.created.status)
    expect(shape(mock.body)).toEqual(shape(samples.created.body))
    // Сервер не возвращает почту — и мок тоже.
    expect('email' in samples.created.body).toBe(false)
  })

  it('200 GET /suggestions', () => {
    expect(shape(list([suggestion()]).body)).toEqual(shape(samples.list.body))
  })

  it('400 invalid_suggestion с причинами по полям', () => {
    const mock = invalid({ title: 'too_short', budget: 'out_of_range', email: 'invalid' })
    expect(mock.status).toBe(samples.invalid.status)
    expect(mock.body).toEqual(samples.invalid.body)
  })

  it('409 duplicate_suggestion', () => {
    const mock = duplicate()
    expect(mock.status).toBe(samples.duplicate.status)
    expect(mock.body).toEqual(samples.duplicate.body)
  })
})
