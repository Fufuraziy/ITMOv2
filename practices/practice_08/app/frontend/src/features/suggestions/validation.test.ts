// Правила формы заявки — те же, что у сервера (R8, backend/internal/suggestions/service_test.go).
import { describe, expect, it } from 'vitest'
import { emptyForm, fromServer, toInput, validate } from './validation'

const ok = { ...emptyForm, title: 'Ужин на двоих', budget: '1500' }

describe('validate', () => {
  it('корректная форма без ошибок, необязательные поля можно не заполнять', () => {
    expect(validate(ok)).toEqual({})
  })

  it.each([
    [{ title: '   ' }, 'title', 'Назовите подборку'],
    [{ title: 'Уж' }, 'title', 'Название — хотя бы 3 символа'],
    [{ title: 'я'.repeat(81) }, 'title', 'Название — не длиннее 80 символов'],
    [{ budget: '' }, 'budget', 'Укажите бюджет'],
    [{ budget: '299' }, 'budget', 'Бюджет — от 300 до 20 000 ₽'],
    [{ budget: '20001' }, 'budget', 'Бюджет — от 300 до 20 000 ₽'],
    [{ budget: '15,5' }, 'budget', 'Бюджет — целое число рублей, например 1500'],
    [{ occasion: 'я'.repeat(41) }, 'occasion', 'Повод — не длиннее 40 символов'],
    [{ comment: 'я'.repeat(501) }, 'comment', 'Не больше 500 символов'],
    [{ email: 'anna@example' }, 'email', 'Проверьте почту: нужен адрес вида name@example.ru'],
  ])('%o → ошибка поля %s', (patch, field, message) => {
    expect(validate({ ...ok, ...patch })).toEqual({ [field]: message })
  })

  it('границы допустимы: 3 и 80 символов, бюджет 300 и 20 000 (с пробелами)', () => {
    expect(validate({ ...ok, title: 'Суп', budget: '300' })).toEqual({})
    expect(validate({ ...ok, title: 'я'.repeat(80), budget: '20 000' })).toEqual({})
  })
})

describe('toInput / fromServer', () => {
  it('обрезает пробелы и переводит бюджет в число — формат тела POST /suggestions', () => {
    expect(toInput({ title: ' Ужин ', occasion: 'ужин', budget: '1 500', comment: ' паста ', email: ' a@b.ru ' }))
      .toEqual({ title: 'Ужин', occasion: 'ужин', budget: 1500, comment: 'паста', email: 'a@b.ru' })
  })

  it('причины сервера превращает в тексты, неизвестные поля пропускает', () => {
    expect(fromServer({ title: 'duplicate', budget: 'out_of_range', ...({ other: 'x' } as object) }))
      .toEqual({ title: 'Такая заявка уже есть — назовите подборку иначе', budget: 'Бюджет — от 300 до 20 000 ₽' })
  })
})
