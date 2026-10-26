import React, { useEffect, useId, useState } from 'react'
import {
  type Collection, type Filters, type Multiplier, type Product, type SearchResult, type Sort, type TagCount, type Variant,
  emptyFilters, fetchTags, fromSearchParams, searchCollections, toSearchParams,
} from '../api'
import { readVariants } from '../servings'

const BUDGETS = [0, 500, 1000, 2000]
const TAGS_VISIBLE = 10
const SORTS: { value: Sort; label: string }[] = [
  { value: 'catalog', label: 'как в каталоге' },
  { value: 'price_asc', label: 'сначала дешевле' },
  { value: 'price_desc', label: 'сначала дороже' },
]

/** 1111 → «1 111 ₽»: обычные пробелы, перенос запрещает CSS. */
export const rub = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`
const qty = (n: number) => String(n).replace('.', ',')
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
const priceDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ г\.$/, '')

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export const App: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(() => fromSearchParams(new URLSearchParams(window.location.search)))
  const [tags, setTags] = useState<TagCount[]>([])
  const [result, setResult] = useState<SearchResult | null>(null)
  const [failed, setFailed] = useState(false)
  const [allTags, setAllTags] = useState(false)
  // Выбранные порции по id подборки: живут до перезагрузки, в адрес и браузер не пишутся (FR-011).
  const [servings, setServings] = useState<Record<string, Multiplier>>({})
  const q = useDebounced(filters.q, 250)
  // Теги отсортированы бэкендом по популярности; выбранный показываем всегда.
  const shownTags = allTags ? tags : tags.filter((t, i) => i < TAGS_VISIBLE || t.tag === filters.tag)
  const hiddenTags = tags.length - shownTags.length

  useEffect(() => {
    fetchTags().then(setTags).catch(() => setTags([]))
  }, [])

  useEffect(() => {
    const f = { ...filters, q }
    const qs = toSearchParams(f).toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    const ctrl = new AbortController()
    searchCollections(f, ctrl.signal)
      .then((r) => { setResult(r); setFailed(false) })
      .catch((err) => { if (err?.name !== 'AbortError') setFailed(true) })
    return () => ctrl.abort()
  }, [q, filters.tag, filters.maxPrice, filters.sort])

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))

  return (
    <div className="page">
      <header className="search">
        <h1 className="search__title">
          <label htmlFor="q">Что приготовим?</label>
        </h1>
        <input
          id="q"
          className="search__input"
          type="search"
          autoComplete="off"
          placeholder="борщ, завтрак, пикник…"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
        />

        <div className="filters">
          {tags.length > 0 && (
            <div className="filters__group" role="group" aria-label="Повод">
              {shownTags.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  className="chip"
                  aria-pressed={filters.tag === t.tag}
                  onClick={() => set({ tag: filters.tag === t.tag ? '' : t.tag })}
                >
                  {t.tag} <span className="chip__count">{t.count}</span>
                </button>
              ))}
              {hiddenTags > 0 && (
                <button type="button" className="chip chip--more" onClick={() => setAllTags(true)}>
                  ещё {hiddenTags}
                </button>
              )}
            </div>
          )}
          <div className="filters__row">
            <div className="filters__group" role="group" aria-label="Бюджет">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  className="chip chip--budget"
                  aria-pressed={filters.maxPrice === b}
                  onClick={() => set({ maxPrice: b })}
                >
                  {b === 0 ? 'любой' : `до ${rub(b)}`}
                </button>
              ))}
            </div>
            <label className="sort">
              Порядок{' '}
              <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as Sort })}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      </header>

      <main className="results" aria-live="polite">
        {!failed && !result && <p className="notice">Ищем подборки…</p>}
        {failed && <p role="alert" className="notice">Каталог не отвечает. Обновите страницу через минуту.</p>}
        {!failed && result && result.total === 0 && (
          <div className="notice">
            <p>
              <strong>
                {filters.q.trim()
                  ? `Ничего не нашлось по запросу «${filters.q.trim()}».`
                  : 'Ничего не нашлось с такими фильтрами.'}
              </strong>{' '}
              Попробуйте другое слово или повод.
            </p>
            <button type="button" className="link-button" onClick={() => setFilters(emptyFilters)}>
              Сбросить поиск
            </button>
          </div>
        )}
        {!failed && result?.collections.map((c) => (
          <Shelf
            key={c.id}
            c={c}
            multiplier={servings[c.id] ?? 1}
            onSelect={(m) => setServings((s) => ({ ...s, [c.id]: m }))}
            maxPrice={filters.maxPrice}
          />
        ))}
      </main>

      {result && (
        <footer className="footer">
          <p>
            Цены на {priceDate(result.updated_at)} из ассортимента ВкусВилла, итог примерный.
            Кнопка корзины открывает vkusvill.ru: там подборку можно положить в корзину и поправить количество.
            Неофициальный каталог.
          </p>
        </footer>
      )}
    </div>
  )
}

type ShelfProps = {
  c: Collection
  multiplier: Multiplier
  onSelect: (m: Multiplier) => void
  maxPrice: number
}

const Shelf: React.FC<ShelfProps> = ({ c, multiplier, onSelect, maxPrice }) => {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const receiptId = useId()
  const servingsName = useId()
  const n = c.products.length
  // Без вариантов (старый бэкенд) карточка как до фичи (FR-010).
  const variants = readVariants(c)
  // Выбранный множитель стал недоступен — показываем ×1 (FR-009).
  const chosen = variants?.find((v) => v.multiplier === multiplier && v.available)
  const active = variants ? chosen ?? variants[0] : null
  const m: Multiplier = active ? active.multiplier : 1
  const total = active ? active.total_price : c.total_price
  const quantity = (p: Product) => (active ? active.quantities[String(p.xml_id)] : p.quantity)
  const overBudget = maxPrice > 0 && total > maxPrice

  return (
    <article className="shelf" aria-labelledby={titleId}>
      <div className="shelf__goods" aria-hidden="true">
        {c.products.slice(0, 5).map((p) => (
          <img key={p.xml_id} className="shelf__item" src={p.image} alt="" loading="lazy" width={112} height={112} />
        ))}
      </div>

      <div className="shelf__body">
        <h2 id={titleId} className="shelf__title">{c.title}</h2>
        <p className="shelf__text">{c.description}</p>
        <ul className="shelf__tags" aria-label="Теги">
          {c.tags.map((t) => <li key={t}>{t}</li>)}
        </ul>

        <div className="shelf__buy">
          {variants && <Servings name={servingsName} variants={variants} value={m} onSelect={onSelect} />}
          <span className="shelf__total" aria-live="polite" aria-atomic="true">
            ≈ {rub(total)}{m > 1 ? ` · ×${m}` : ''}
            {overBudget && <span className="shelf__over-budget">больше бюджета</span>}
          </span>
          <a className="cart" href={active ? active.cart_url : c.cart_url} target="_blank" rel="noopener noreferrer">
            {m > 1 ? `Перенести в корзину ВкусВилла · ×${m}` : 'Перенести в корзину ВкусВилла'}
          </a>
          <button
            type="button"
            className="link-button"
            aria-expanded={open}
            aria-controls={receiptId}
            onClick={() => setOpen(!open)}
          >
            Состав: {n} {plural(n, 'товар', 'товара', 'товаров')}
          </button>
        </div>

        <div id={receiptId} className="receipt" data-open={open} hidden={!open}>
          <ul className="receipt__list" aria-label={`Состав подборки «${c.title}»`}>
            {c.products.map((p) => (
              <li key={p.xml_id} className="receipt__line">
                <a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}</a>
                <span className="receipt__dots" aria-hidden="true" />
                <span className="receipt__price">
                  {qty(quantity(p))} {p.unit}
                  {m > 1 && p.scalable === true && p.base_quantity !== undefined && (
                    <span className="receipt__was"> · было {qty(p.base_quantity)} {p.unit}</span>
                  )}
                  {' '}× {rub(p.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

type ServingsProps = {
  name: string
  variants: Variant[]
  value: Multiplier
  onSelect: (m: Multiplier) => void
}

/** Порции ×1/×2/×4: нативные radio — стрелки и «выбрано» для программ чтения с экрана (research R-2). */
const Servings: React.FC<ServingsProps> = ({ name, variants, value, onSelect }) => (
  <fieldset className="servings">
    <legend className="servings__legend">Порции</legend>
    <div className="servings__track">
      {variants.map((v) => (
        <label key={v.multiplier} className="servings__option">
          <input
            type="radio"
            className="servings__input"
            name={name}
            value={v.multiplier}
            checked={v.multiplier === value}
            disabled={!v.available}
            aria-describedby={v.available ? undefined : `${name}-reason-${v.multiplier}`}
            onChange={() => onSelect(v.multiplier)}
          />
          <span className="servings__face">×{v.multiplier}</span>
        </label>
      ))}
    </div>
    {variants.filter((v) => !v.available).map((v) => (
      <span key={v.multiplier} id={`${name}-reason-${v.multiplier}`} className="servings__reason">
        {v.reason ?? `×${v.multiplier} пока недоступно`}
      </span>
    ))}
  </fieldset>
)
