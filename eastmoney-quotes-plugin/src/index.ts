/** Host face: watchlist storage, symbol search, and quote routes. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { fetchQuotes, searchEmStocks } from './em-api.ts'
import { addToWatchlist, currentWatchlist, removeFromWatchlist, reorderWatchlist } from './watchlist.ts'
import { currentApiSettings, loadApiSettings, saveApiSettings } from './settings.ts'
import { type Config, type QuoteSourceChoice } from './config.ts'

export { Config } from './config.ts'

/** JSON body answered by the `/em-quotes/list` route. */
export interface EmQuotesSummary {
  /** Current watchlist codes. */
  codes: readonly string[]
  /** Source that answered this request. */
  source?: string
  /** Latest quote rows. */
  rows?: readonly unknown[]
  /** Latest failure reason when every source failed. */
  failure?: string
  /** Millisecond epoch of the last successful fetch. */
  fetchedAt?: number
}

/** Required service keys. */
export const inject = ['webServer']

/**
 * Register the watchlist, search, and quote routes. Quotes are fetched per
 * request; the client owns its polling cadence, so no host-side cache is needed.
 * @param ctx - Host context.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const configured = (): string[] => config.symbols.get().split(/[\s,，;；]+/u).filter((code) => code !== '')

  /** Effective data-source settings: UI-stored values win over the plugin config. */
  const apiOptions = () => currentApiSettings({ apiBaseUrl: config.apiBaseUrl.get(), apiKey: config.apiKey.get() })

  const send = (response: ServerResponse, body: unknown): void => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }

  const defect = (error: unknown): string =>
    `handler defect: ${error instanceof Error ? error.message : String(error)}`

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/em-quotes/list',
    handler: async (_request: IncomingMessage, response: ServerResponse) => {
      let body: EmQuotesSummary
      try {
        const requested = currentWatchlist(configured())
        const result = await fetchQuotes(requested, config.source.get() as QuoteSourceChoice, fetch, apiOptions())
        body = result.ok
          ? { codes: requested, source: result.source, rows: result.value, fetchedAt: Date.now() }
          : { codes: requested, failure: result.error }
      } catch (error: unknown) {
        // Surface handler defects to the client instead of the webserver's bare 400.
        body = { codes: [], failure: defect(error) }
      }
      send(response, body)
    },
  }), 'eastmoney-quotes: list route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/em-quotes/search',
    handler: async (request, response) => {
      const query = new URL(request.url ?? '/', 'http://dsh.invalid').searchParams.get('q') ?? ''
      const result = await searchEmStocks(query)
      if (!result.ok) {
        send(response, { failure: result.error })
        return
      }
      // Merge a live quote summary into each suggestion for the search card.
      const codes = result.value.map((row) => row.code)
      const quotes = await fetchQuotes(codes, 'auto', fetch, apiOptions())
      const byCode = new Map(quotes.ok ? quotes.value.map((row) => [row.code, row]) : [])
      send(response, {
        results: result.value.map((row) => {
          const quote = byCode.get(row.code)
          return quote === undefined ? row : { ...row, price: quote.price, changePct: quote.changePct }
        }),
      })
    },
  }), 'eastmoney-quotes: search route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/em-quotes/watchlist',
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        send(response, { symbols: currentWatchlist(configured()) })
        return
      }
      const raw = await readBody(request)
      try {
        const parsed = JSON.parse(raw) as { symbol?: unknown; remove?: unknown; order?: unknown }
        if (Array.isArray(parsed.order)) {
          const order = parsed.order.filter((symbol): symbol is string => typeof symbol === 'string')
          send(response, { symbols: reorderWatchlist(configured(), order) })
          return
        }
        if (typeof parsed.symbol !== 'string') throw new Error('body must carry a string "symbol" or an "order" array')
        const symbols = parsed.remove === true
          ? removeFromWatchlist(configured(), parsed.symbol)
          : addToWatchlist(configured(), parsed.symbol)
        send(response, { symbols })
      } catch (error: unknown) {
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ failure: error instanceof Error ? error.message : String(error) }))
      }
    },
  }), 'eastmoney-quotes: watchlist route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/em-quotes/settings',
    handler: async (request, response) => {
      if (request.method !== 'POST') {
        const effective = apiOptions()
        // Mask the key for display; the client sends the raw value back unchanged
        // unless the user types a replacement.
        send(response, {
          apiBaseUrl: effective.apiBaseUrl,
          apiKey: effective.apiKey === '' ? '' : `•••${effective.apiKey.slice(-4)}`,
          apiKeySet: effective.apiKey !== '',
        })
        return
      }
      const raw = await readBody(request)
      try {
        const parsed = JSON.parse(raw) as { apiBaseUrl?: unknown; apiKey?: unknown }
        if (parsed.apiBaseUrl !== undefined && typeof parsed.apiBaseUrl !== 'string') throw new Error('"apiBaseUrl" must be a string')
        if (parsed.apiKey !== undefined && typeof parsed.apiKey !== 'string') throw new Error('"apiKey" must be a string')
        const masked = typeof parsed.apiKey === 'string' && /^•••/u.test(parsed.apiKey)
        if (masked) throw new Error('"apiKey" looks masked — send the real key or omit it to keep the stored one')
        const current = loadApiSettings() ?? { apiBaseUrl: '', apiKey: '' }
        saveApiSettings({
          apiBaseUrl: typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl.trim() : (current.apiBaseUrl ?? ''),
          apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : (current.apiKey ?? ''),
        })
        const effective = apiOptions()
        send(response, {
          apiBaseUrl: effective.apiBaseUrl,
          apiKey: effective.apiKey === '' ? '' : `•••${effective.apiKey.slice(-4)}`,
          apiKeySet: effective.apiKey !== '',
        })
      } catch (error: unknown) {
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ failure: error instanceof Error ? error.message : String(error) }))
      }
    },
  }), 'eastmoney-quotes: settings route')
}

/** Read one request body as UTF-8 text, bounded to 64 KiB. */
function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 65_536) {
        rejectPromise(new Error('body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => { resolvePromise(Buffer.concat(chunks).toString('utf8')) })
    request.on('error', rejectPromise)
  })
}
