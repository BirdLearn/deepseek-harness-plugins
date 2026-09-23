/** Client face: settings section registration fed by the Host watchlist route. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { en, zh, type QuotesKey } from './locales.ts'
import { QuotesSection, type QuotesInjected, type QuotesSnapshot } from './QuotesSection.tsx'
import { ComposerQuotesRing } from './WatchlistCompact.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Watchlist quotes copy namespace. */
    'em.quotes': QuotesKey
  }
}

/** Required service keys. */
export const inject = ['slots', 'locale']

/** Body answered by the Host `/em-quotes/list` route. */
interface SummaryBody {
  codes: readonly string[]
  rows?: readonly unknown[]
  failure?: string
  fetchedAt?: number
  source?: string
}

/** Body answered by the Host `/em-quotes/settings` route. */
interface SettingsBody extends ApiSettingsView {
  failure?: string
}

/** Data-source settings as shown in the panel's settings card. */
export interface ApiSettingsView {
  apiBaseUrl: string
  apiKey: string
  apiKeySet: boolean
}

/**
 * Register the watchlist quotes section into the settings page.
 * @param ctx - Browser context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('em.quotes', { en, zh }), 'em.quotes: dictionaries')
  const t = ctx.locale.bind('em.quotes')

  let snapshot: QuotesSnapshot = { loading: true, failed: false, codes: [], rows: [],
    settings: { apiBaseUrl: '', apiKey: '', apiKeySet: false } }
  const listeners = new Set<() => void>()
  const publish = (value: QuotesSnapshot): void => {
    snapshot = value
    for (const listener of listeners) listener()
  }

  const loadSettings = async (): Promise<ApiSettingsView> => {
    try {
      const response = await fetch('/em-quotes/settings')
      const text = await response.text()
      if (!response.ok || text.trim() === '') {
        publish({ ...snapshot, failed: true,
          failure: `Host 路由 /em-quotes/settings 不可用（HTTP ${String(response.status)}）— 请完全退出并重启应用让 Host 半边加载新代码` })
        return snapshot.settings
      }
      const body = JSON.parse(text) as SettingsBody
      if (body.failure === undefined) {
        const settings: ApiSettingsView = { apiBaseUrl: body.apiBaseUrl, apiKey: body.apiKey, apiKeySet: body.apiKeySet }
        publish({ ...snapshot, settings })
        return settings
      }
    } catch {
      // Settings display is best-effort; the quotes fetch reports host failures.
    }
    return snapshot.settings
  }

  const saveSettings = async (input: { apiBaseUrl: string; apiKey?: string }): Promise<ApiSettingsView> => {
    const response = await fetch('/em-quotes/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const text = await response.text()
    if (text.trim() === '') {
      throw new Error(`Host 路由不可用（HTTP ${String(response.status)}）— 请完全退出并重启应用（Cmd+Q）让 Host 半边加载新代码`)
    }
    let body: SettingsBody
    try {
      body = JSON.parse(text) as SettingsBody
    } catch {
      throw new Error('Host 返回了非 JSON 响应 — 请重启应用让 Host 半边生效')
    }
    if (body.failure !== undefined) throw new Error(body.failure)
    const settings: ApiSettingsView = { apiBaseUrl: body.apiBaseUrl, apiKey: body.apiKey, apiKeySet: body.apiKeySet }
    publish({ ...snapshot, settings })
    return settings
  }

  const refresh = async (): Promise<void> => {
    try {
      const startedAt = performance.now()
      const response = await fetch('/em-quotes/list')
      if (!response.ok) {
        // 404/5xx with an empty body means the Host half is not answering
        // (not activated yet, or the app needs a restart after install).
        publish({ ...snapshot, loading: false, failed: true, codes: [], rows: [],
          failure: `Host route unavailable (HTTP ${String(response.status)}) — 插件 Host 半边未激活，安装后请重启应用` })
        return
      }
      let body: SummaryBody
      try {
        body = await response.json() as SummaryBody
      } catch {
        publish({ ...snapshot, loading: false, failed: true, codes: [], rows: [], failure: 'Host answered a non-JSON body — 请重启应用让 Host 半边生效' })
        return
      }
      publish({
        ...snapshot,
        loading: false,
        failed: body.failure !== undefined,
        failure: body.failure,
        codes: body.codes,
        rows: (body.rows ?? []) as QuotesSnapshot['rows'],
        fetchedAt: body.fetchedAt,
        delayMs: Math.round(performance.now() - startedAt),
        lastSource: body.source,
      })
    } catch (error: unknown) {
      publish({ ...snapshot, loading: false, failed: true, codes: [], rows: [],
        failure: error instanceof Error ? error.message : 'network request failed' })
    }
  }
  void refresh()
  void loadSettings()
  // Realtime cadence: 10s while the harness is open; the Eastmoney public
  // endpoint tolerates this rate for a handful of symbols.
  const poll = setInterval(() => { void refresh() }, 10_000)
  ctx.effect(() => () => { clearInterval(poll) }, 'em.quotes: poll timer')

  const search = async (query: string) => {
    const response = await fetch(`/em-quotes/search?q=${encodeURIComponent(query)}`)
    const body = await response.json() as { results?: readonly unknown[]; failure?: string }
    if (body.failure !== undefined) throw new Error(body.failure)
    return (body.results ?? []) as readonly { code: string; name: string; marketLabel: string; price?: number; changePct?: number }[]
  }

  const add = async (symbol: string): Promise<void> => {
    await fetch('/em-quotes/watchlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol }) })
    await refresh()
  }

  const remove = async (symbol: string): Promise<void> => {
    await fetch('/em-quotes/watchlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol, remove: true }) })
    await refresh()
  }

  const reorder = async (order: readonly string[]): Promise<void> => {
    await fetch('/em-quotes/watchlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order }) })
    await refresh()
  }

  const operations: QuotesInjected = {
    refresh,
    search,
    add,
    remove,
    reorder,
    loadSettings,
    saveSettings,
    hooks: {
      quotes: {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      },
    },
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'em-quotes',
    order: 41,
    label: () => t('nav'),
    locale: 'em.quotes',
    inject: () => operations,
  }, QuotesSection))

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    locale: 'em.quotes',
    id: 'em-quotes-badge',
    order: 20,
    inject: () => operations,
  }, ComposerQuotesRing))
}
