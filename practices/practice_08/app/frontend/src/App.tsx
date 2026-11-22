// Корень приложения: шапка с вкладками «Найти подборку» / «Заявки куратору» (макет — practice_08/mockup).
import React, { useCallback, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { SearchPage } from '@/features/search/SearchPage'
import { SuggestionsPage } from '@/features/suggestions/SuggestionsPage'

type Tab = 'search' | 'suggestions'

// Вкладки-подчёркивания, как в макете: активная — полужирная, с зелёной линией.
const tabClass = 'h-11 px-1 text-sm text-muted-foreground data-active:font-bold data-active:text-foreground after:!bg-primary'

/** Вкладка в адресе (#suggestions), чтобы на заявки можно было дать ссылку. */
const tabFromHash = (): Tab => (window.location.hash === '#suggestions' ? 'suggestions' : 'search')

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [draftTitle, setDraftTitle] = useState<string | null>(null)

  const changeTab = (next: string) => {
    const t = next as Tab
    setTab(t)
    const url = window.location.pathname + window.location.search + (t === 'suggestions' ? '#suggestions' : '')
    window.history.replaceState(null, '', url)
  }

  const suggestFromSearch = (title: string) => {
    setDraftTitle(title)
    changeTab('suggestions')
  }
  const draftConsumed = useCallback(() => setDraftTitle(null), [])

  return (
    <Tabs value={tab} onValueChange={changeTab} className="min-h-dvh gap-0">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pt-2 sm:px-6">
          <span className="text-lg font-extrabold tracking-tight">Подборки ВкусВилла</span>
          <TabsList aria-label="Разделы" variant="line" className="h-12 gap-4">
            <TabsTrigger value="search" className={tabClass}>Найти подборку</TabsTrigger>
            <TabsTrigger value="suggestions" className={tabClass}>Заявки куратору</TabsTrigger>
          </TabsList>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <TabsContent value="search">
          <SearchPage onSuggest={suggestFromSearch} />
        </TabsContent>
        <TabsContent value="suggestions">
          <SuggestionsPage draftTitle={draftTitle} onDraftConsumed={draftConsumed} />
        </TabsContent>
      </div>
      <Toaster position="top-center" richColors={false} closeButton />
    </Tabs>
  )
}
