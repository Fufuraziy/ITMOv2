// Поиск подборок (docs/requirements.md, R2, R5, R7) на компонентах shadcn/ui.
import React, { useEffect, useId, useState } from 'react'
import { ChevronDownIcon, ExternalLinkIcon } from 'lucide-react'
import {
  type Collection, type Filters, type Multiplier, type Product, type SearchResult, type Sort, type TagCount, type Variant,
  emptyFilters, fetchTags, fromSearchParams, searchCollections, toSearchParams,
} from '@/api'
import { readVariants } from '@/servings'
import { plural, priceDate, qty, rub } from '@/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

const BUDGETS = [0, 500, 1000, 2000]
const TAGS_VISIBLE = 10
const SORTS: { value: Sort; label: string }[] = [
  { value: 'catalog', label: 'как в каталоге' },
  { value: 'price_asc', label: 'сначала дешевле' },
  { value: 'price_desc', label: 'сначала дороже' },
]

// Чип фильтра — Toggle из shadcn/ui: aria-pressed и фокус даёт Radix, вид — общая тема.
const chip = 'h-9 rounded-full border border-border bg-card px-3.5 text-[0.95rem] font-normal text-foreground hover:bg-muted data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

type Props = {
  /** «Предложить такую подборку» из пустого результата: открывает заявку с этим названием. */
  onSuggest?: (title: string) => void
}

export const SearchPage: React.FC<Props> = ({ onSuggest }) => {
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
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <h1 className="text-[clamp(2.25rem,6vw,4.5rem)] leading-none font-extrabold tracking-tight">
          <label htmlFor="q" className="cursor-text">Что приготовим?</label>
        </h1>
        <Input
          id="q"
          type="search"
          autoComplete="off"
          placeholder="борщ, завтрак, пикник…"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          className="h-14 rounded-xl px-4 text-xl font-semibold text-primary placeholder:font-normal md:text-2xl"
        />

        <div className="flex flex-col gap-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Повод">
              {shownTags.map((t) => (
                <Toggle
                  key={t.tag}
                  className={chip}
                  pressed={filters.tag === t.tag}
                  onPressedChange={() => set({ tag: filters.tag === t.tag ? '' : t.tag })}
                >
                  {t.tag} <span className="text-xs tabular-nums opacity-60">{t.count}</span>
                </Toggle>
              ))}
              {hiddenTags > 0 && (
                <Button type="button" variant="ghost" className="h-9 rounded-full border border-dashed border-input px-3.5 font-normal text-muted-foreground" onClick={() => setAllTags(true)}>
                  ещё {hiddenTags}
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Бюджет">
              {BUDGETS.map((b) => (
                <Toggle
                  key={b}
                  className={cn(chip, 'tabular-nums whitespace-nowrap')}
                  pressed={filters.maxPrice === b}
                  onPressedChange={() => set({ maxPrice: b })}
                >
                  {b === 0 ? 'любой' : `до ${rub(b)}`}
                </Toggle>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Порядок
              <NativeSelect value={filters.sort} onChange={(e) => set({ sort: e.target.value as Sort })}>
                {SORTS.map((s) => <NativeSelectOption key={s.value} value={s.value}>{s.label}</NativeSelectOption>)}
              </NativeSelect>
            </label>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-6" aria-live="polite">
        {!failed && !result && <p className="text-muted-foreground">Ищем подборки…</p>}
        {failed && (
          <Alert variant="destructive" className="max-w-xl">
            <AlertDescription>Каталог не отвечает. Обновите страницу через минуту.</AlertDescription>
          </Alert>
        )}
        {!failed && result && result.total === 0 && (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p>
              <strong>
                {filters.q.trim()
                  ? `Ничего не нашлось по запросу «${filters.q.trim()}».`
                  : 'Ничего не нашлось с такими фильтрами.'}
              </strong>{' '}
              Попробуйте другое слово или повод.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setFilters(emptyFilters)}>
                Сбросить поиск
              </Button>
              {onSuggest && (
                <Button type="button" onClick={() => onSuggest(filters.q.trim())}>
                  Предложить такую подборку
                </Button>
              )}
            </div>
          </Card>
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
        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
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
    <Card role="article" aria-labelledby={titleId} className="grid gap-6 p-5 md:grid-cols-[minmax(240px,5fr)_7fr] md:p-6">
      <div className="flex items-end gap-2 overflow-hidden border-b-4 border-border pb-1" aria-hidden="true">
        {c.products.slice(0, 5).map((p) => (
          <img key={p.xml_id} className="size-20 shrink-0 rounded-lg bg-muted object-cover md:size-24" src={p.image} alt="" loading="lazy" width={96} height={96} />
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <h2 id={titleId} className="text-2xl font-extrabold tracking-tight">{c.title}</h2>
        <p className="text-muted-foreground">{c.description}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Теги">
          {c.tags.map((t) => <li key={t}><Badge variant="secondary">{t}</Badge></li>)}
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
          {variants && <Servings name={servingsName} variants={variants} value={m} onSelect={onSelect} />}
          <span className="text-xl font-bold whitespace-nowrap tabular-nums" aria-live="polite" aria-atomic="true">
            ≈ {rub(total)}{m > 1 ? ` · ×${m}` : ''}
            {overBudget && <Badge variant="destructive" className="ml-2 align-middle">больше бюджета</Badge>}
          </span>
          <Button asChild size="lg">
            <a href={active ? active.cart_url : c.cart_url} target="_blank" rel="noopener noreferrer">
              {m > 1 ? `Перенести в корзину ВкусВилла · ×${m}` : 'Перенести в корзину ВкусВилла'}
            </a>
          </Button>
          <Button
            type="button"
            variant="link"
            className="px-0 text-foreground underline underline-offset-4"
            aria-expanded={open}
            aria-controls={receiptId}
            onClick={() => setOpen(!open)}
          >
            Состав: {n} {plural(n, 'товар', 'товара', 'товаров')}
            <ChevronDownIcon data-icon="inline-end" aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        </div>

        <div id={receiptId} hidden={!open} className="rounded-lg bg-muted/60 p-4">
          <ul className="flex flex-col gap-2" aria-label={`Состав подборки «${c.title}»`}>
            {c.products.map((p) => (
              <li key={p.xml_id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{p.name}</a>
                <span className="min-w-4 flex-1 border-b border-dotted border-input" aria-hidden="true" />
                <span className="receipt__price whitespace-nowrap tabular-nums text-muted-foreground">
                  {qty(quantity(p))} {p.unit}
                  {m > 1 && p.scalable === true && p.base_quantity !== undefined && (
                    <span> · было {qty(p.base_quantity)} {p.unit}</span>
                  )}
                  {' '}× {rub(p.price)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <ExternalLinkIcon className="size-3" aria-hidden="true" /> товары открываются на vkusvill.ru
          </p>
        </div>
      </div>
    </Card>
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
  <fieldset className="flex flex-col gap-1">
    <legend className="sr-only">Порции</legend>
    <div className="inline-flex rounded-lg border border-input bg-card p-0.5">
      {variants.map((v) => (
        <label key={v.multiplier} className="relative">
          <input
            type="radio"
            className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            name={name}
            value={v.multiplier}
            checked={v.multiplier === value}
            disabled={!v.available}
            aria-describedby={v.available ? undefined : `${name}-reason-${v.multiplier}`}
            onChange={() => onSelect(v.multiplier)}
          />
          <span className="flex h-9 min-w-11 items-center justify-center rounded-md px-2 text-sm font-semibold tabular-nums peer-checked:bg-primary peer-checked:text-primary-foreground peer-disabled:text-muted-foreground peer-disabled:line-through peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
            ×{v.multiplier}
          </span>
        </label>
      ))}
    </div>
    {variants.filter((v) => !v.available).map((v) => (
      <span key={v.multiplier} id={`${name}-reason-${v.multiplier}`} className="max-w-60 text-xs text-muted-foreground">
        {v.reason ?? `×${v.multiplier} пока недоступно`}
      </span>
    ))}
  </fieldset>
)
