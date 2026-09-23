/** Watchlist realtime quotes with multi-source fallback for the Host face. */

/** One watchlist quote row as rendered by the client. */
export interface EmQuote {
  /** Six-digit board code, e.g. `600519`. */
  readonly code: string
  /** Market id as reported by Eastmoney: `1` Shanghai, `0` Shenzhen; absent on other providers. */
  readonly market?: number
  /** Display name, e.g. `贵州茅台`; absent when the row omits it. */
  readonly name?: string
  /** Last price; `undefined` when suspended or unknown. */
  readonly price?: number
  /** Change percentage. */
  readonly changePct?: number
  /** Change amount. */
  readonly changeAmt?: number
  /** Today's open. */
  readonly open?: number
  /** Day high. */
  readonly high?: number
  /** Day low. */
  readonly low?: number
  /** Previous close. */
  readonly prevClose?: number
  /** Volume in lots (手). */
  readonly volume?: number
  /** Turnover in yuan. */
  readonly amount?: number
  /** Source-reported quote time in milliseconds; absent when the provider omits it. */
  readonly quoteTime?: number
}

/** Quote data sources in fallback order. */
export type QuoteSource = 'eastmoney' | 'tencent' | 'sina'

/** Provider chain used by `source: auto`. */
export const SOURCE_CHAIN: readonly QuoteSource[] = ['eastmoney', 'tencent', 'sina']

export type EmQuotesResult = { readonly ok: true; readonly source: QuoteSource; readonly value: readonly EmQuote[] } | { readonly ok: false; readonly error: string }

const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9',
}

/**
 * Map one board code to Eastmoney's `market.code` secid.
 * `6` Shanghai, `0`/`3` Shenzhen main/growth, `4`/`8`/`9` Beijing; an explicit
 * `sh`/`sz`/`bj` prefix wins.
 * @param code - user-entered symbol.
 * @returns The secid, or `undefined` when the code is not a supported A-share shape.
 */
export function toSecid(code: string): string | undefined {
  const normalized = normalizeCode(code)
  if (normalized === undefined) return undefined
  if (normalized.exchange === 'sh') return `1.${normalized.digits}`
  if (normalized.exchange === 'hk') return `116.${normalized.digits}`
  if (normalized.exchange === 'us') return `105.${normalized.digits}`
  return `0.${normalized.digits}`
}

interface NormalizedCode {
  /** Code within its market: 6 digits for A-shares, 1-5 digits for HK, the ticker for US. */
  readonly digits: string
  readonly exchange: 'sh' | 'sz' | 'bj' | 'hk' | 'us'
}

function normalizeCode(code: string): NormalizedCode | undefined {
  const trimmed = code.trim().toLowerCase()
  if (trimmed === '') return undefined
  const prefixed = /^(sh|sz|bj)(\d{6})$/u.exec(trimmed)
  if (prefixed !== null) return { digits: prefixed[2], exchange: prefixed[1] as 'sh' | 'sz' | 'bj' }
  const hk = /^hk(\d{1,5})$/u.exec(trimmed)
  if (hk !== null) return { digits: hk[1], exchange: 'hk' }
  const us = /^us([a-z.]{1,6})$/u.exec(trimmed)
  if (us !== null) return { digits: us[1].toUpperCase(), exchange: 'us' }
  if (!/^\d{6}$/u.test(trimmed)) return undefined
  if (trimmed.startsWith('6') || trimmed.startsWith('5')) return { digits: trimmed, exchange: 'sh' }
  if (trimmed.startsWith('0') || trimmed.startsWith('3') || trimmed.startsWith('1')) return { digits: trimmed, exchange: 'sz' }
  if (trimmed.startsWith('4') || trimmed.startsWith('8') || trimmed.startsWith('9')) return { digits: trimmed, exchange: 'bj' }
  return undefined
}

/**
 * The code a provider echoes back for one stored symbol (HK/US rows echo the
 * bare market code, so rows are matched back to stored symbols through this).
 */
function providerCodeOf(symbol: string): string | undefined {
  const normalized = normalizeCode(symbol)
  return normalized === undefined ? undefined : normalized.digits
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Spread helper: `withValue(key, maybe)` omits `undefined` values cleanly. */
function withValue<K extends keyof EmQuote>(key: K, value: EmQuote[K] | undefined): Partial<EmQuote> {
  return (value === undefined ? {} : { [key]: value }) as Partial<EmQuote>
}

// --- Eastmoney ----------------------------------------------------------------

interface RawEmDiff {
  f124?: unknown
  f2?: unknown
  f3?: unknown
  f4?: unknown
  f5?: unknown
  f6?: unknown
  f12?: unknown
  f13?: unknown
  f14?: unknown
  f15?: unknown
  f16?: unknown
  f17?: unknown
  f18?: unknown
}

/** Parse one Eastmoney `ulist.np/get` body; unmatched rows are dropped. */
export function parseEmQuotes(body: unknown, requestedCodes: readonly string[]): readonly EmQuote[] {
  const data = body instanceof Object && 'data' in body && body.data instanceof Object ? (body as { data: unknown }).data : undefined
  const diff = data instanceof Object && 'diff' in data && Array.isArray((data as { diff: unknown }).diff) ? (data as { diff: unknown[] }).diff : []
  const valid = new Set(requestedCodes)
  return diff.flatMap((entry): EmQuote[] => {
    if (!(entry instanceof Object)) return []
    const raw = entry as RawEmDiff
    const code = str(raw.f12)
    if (code === undefined || !valid.has(code)) return []
    return [{
      code,
      ...withValue('market', num(raw.f13)),
      ...withValue('name', str(raw.f14)),
      ...withValue('price', num(raw.f2)),
      ...withValue('changePct', num(raw.f3)),
      ...withValue('changeAmt', num(raw.f4)),
      ...withValue('open', num(raw.f17)),
      ...withValue('high', num(raw.f15)),
      ...withValue('low', num(raw.f16)),
      ...withValue('prevClose', num(raw.f18)),
      ...withValue('volume', num(raw.f5)),
      ...withValue('amount', num(raw.f6)),
    }]
  })
}

// --- Tencent (qt.gtimg.cn, GBK) -----------------------------------------------

/**
 * Parse one Tencent `qt.gtimg.cn` body into quotes. Percentages missing from
 * the row are derived from price and previous close.
 */
export function parseTencentQuotes(text: string, requestedCodes: readonly string[]): readonly EmQuote[] {
  const valid = new Set(requestedCodes)
  return text.split(';').flatMap((line): EmQuote[] => {
    const match = /v_(sh|sz|bj|hk|us)([\w.]{1,6})="([^"]*)"/u.exec(line)
    if (match === null) return []
    const digits = match[2]
    if (!valid.has(digits)) return []
    const fields = match[3].split('~')
    const price = numberOrNull(fields[3])
    const prevClose = numberOrNull(fields[4])
    const volumeLots = numberOrNull(fields[6])
    const changeAmt = numberOrNull(fields[31]) ?? derive(price, prevClose, (a, b) => a - b)
    const changePct = numberOrNull(fields[32]) ?? derive(price, prevClose, (a, b) => Number(((a - b) / b * 100).toFixed(2)))
    const amountWan = numberOrNull(fields[37])
    const qt = parseTencentTime(fields[30])
    return [{
      code: digits,
      ...withValue('name', emptyToUndefined(fields[1])),
      ...withValue('price', price),
      ...withValue('prevClose', prevClose),
      ...withValue('open', numberOrNull(fields[5])),
      ...withValue('volume', volumeLots),
      ...withValue('changeAmt', changeAmt),
      ...withValue('changePct', changePct),
      ...withValue('high', numberOrNull(fields[33])),
      ...withValue('low', numberOrNull(fields[34])),
      ...withValue('amount', amountWan === undefined ? undefined : amountWan * 10_000),
      ...withValue('quoteTime', qt),
    }]
  })
}

// --- Sina (hq.sinajs.cn, GBK) --------------------------------------------------

/**
 * Parse one Sina `hq.sinajs.cn` body into quotes. Sina rows carry no change
 * columns, so both are derived from price and previous close.
 */
export function parseSinaQuotes(text: string, requestedCodes: readonly string[]): readonly EmQuote[] {
  const valid = new Set(requestedCodes)
  return text.split('\n').flatMap((line): EmQuote[] => {
    const match = /hq_str_(?:sh|sz|bj)(\d{6})="([^"]*)"/u.exec(line)
    if (match === null) return []
    const digits = match[1]
    if (!valid.has(digits)) return []
    const fields = match[2].split(',')
    const price = numberOrNull(fields[3])
    const prevClose = numberOrNull(fields[2])
    const volumeShares = numberOrNull(fields[8])
    const qt = parseSinaTime(fields[30], fields[31])
    return [{
      code: digits,
      ...withValue('name', emptyToUndefined(fields[0])),
      ...withValue('price', price),
      ...withValue('open', numberOrNull(fields[1])),
      ...withValue('prevClose', prevClose),
      ...withValue('high', numberOrNull(fields[4])),
      ...withValue('low', numberOrNull(fields[5])),
      ...withValue('volume', volumeShares === undefined ? undefined : Math.round(volumeShares / 100)),
      ...withValue('amount', numberOrNull(fields[9])),
      ...withValue('changeAmt', derive(price, prevClose, (a, b) => a - b)),
      ...withValue('changePct', derive(price, prevClose, (a, b) => Number(((a - b) / b * 100).toFixed(2)))),
      ...withValue('quoteTime', qt),
    }]
  })
}

/** Parse Tencent's quote time: `2026/09/23 11:24:34` (HK) or `20260923112434` (A-share). */
function parseTencentTime(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const digits = value.replace(/\D/gu, '')
  if (digits.length < 12) return undefined
  const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14)}`
  const parsed = Date.parse(iso + '+08:00')
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Parse Sina's split date + time fields (Beijing time). */
function parseSinaTime(date: string | undefined, time: string | undefined): number | undefined {
  if (date === undefined || time === undefined) return undefined
  const parsed = Date.parse(`${date}T${time}+08:00`)
  return Number.isFinite(parsed) ? parsed : undefined
}

function numberOrNull(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value
}

function derive(price: number | undefined, base: number | undefined, compute: (price: number, base: number) => number): number | undefined {
  return price === undefined || base === undefined || base === 0 ? undefined : compute(price, base)
}

// --- Fetch chain ----------------------------------------------------------------

async function fetchText(url: string, headers: Record<string, string>, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(url, { headers })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  return await response.text()
}

function gbkDecode(buffer: ArrayBuffer): string {
  return new TextDecoder('gbk').decode(buffer)
}

async function fetchFromSource(source: QuoteSource, codes: readonly string[], providerCodes: readonly string[], fetchImpl: typeof fetch): Promise<readonly EmQuote[]> {
  if (source === 'eastmoney') {
    const secids = codes.flatMap((code) => {
      const secid = toSecid(code)
      return secid === undefined ? [] : [secid]
    })
    const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get'
      + '?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f13,f14,f15,f16,f17,f18'
      + `&secids=${secids.join(',')}`
    const text = await fetchText(url, { ...BROWSER_HEADERS, referer: 'https://quote.eastmoney.com/' }, fetchImpl)
    return parseEmQuotes(JSON.parse(text) as unknown, providerCodes)
  }
  const symbols = codes.flatMap((code) => {
    const normalized = normalizeCode(code)
    if (normalized === undefined || normalized.exchange === 'us') return []
    return [`${normalized.exchange}${normalized.digits}`]
  })
  if (source === 'tencent') {
    const buffer = await fetchImpl('https://qt.gtimg.cn/q=' + symbols.join(','), { headers: { ...BROWSER_HEADERS } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
        return response.arrayBuffer()
      })
    return parseTencentQuotes(gbkDecode(buffer), providerCodes)
  }
  const buffer = await fetchImpl('https://hq.sinajs.cn/list=' + symbols.join(','), {
    headers: { ...BROWSER_HEADERS, referer: 'https://finance.sina.com.cn/' },
  }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
    return response.arrayBuffer()
  })
  return parseSinaQuotes(gbkDecode(buffer), codes)
}

/**
 * Fetch realtime quotes, trying sources in order until one answers with rows.
 * @param codes - board codes without market prefixes.
 * @param source - `auto` walks the fallback chain; a fixed name asks one source.
 * @param fetchImpl - Injectable fetch for tests.
 * @returns The quote rows with the answering source, or the last failure.
 */
export async function fetchQuotes(
  codes: readonly string[],
  source: 'auto' | QuoteSource = 'auto',
  fetchImpl: typeof fetch = fetch,
): Promise<EmQuotesResult> {
  if (codes.length === 0) return { ok: false, error: 'watchlist is empty' }
  const chain = source === 'auto' ? SOURCE_CHAIN : [source]
  const providerCodes = codes.flatMap((symbol) => {
    const provider = providerCodeOf(symbol)
    return provider === undefined ? [] : [provider]
  })
  let lastError = 'no source answered'
  for (const candidate of chain) {
    try {
      const value = await fetchFromSource(candidate, codes, providerCodes, fetchImpl)
      if (value.length > 0) return { ok: true, source: candidate, value }
      lastError = `${candidate}: no matching row for the watchlist`
    } catch (error: unknown) {
      lastError = `${candidate}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  return { ok: false, error: lastError }
}

/** Backward-compatible alias for the Eastmoney-only face. */
export const fetchEmQuotes = fetchQuotes

// --- Symbol search ---------------------------------------------------------------
// Primary: Tencent smartbox (stable, pinyin + CJK). Fallback: Eastmoney suggest
// (its edge load-balances between the stock table and an unrelated guba search,
// so it only serves as a backup).

/** One search suggestion; quote summary fields attach when merged by the host. */
export interface EmSuggestion {
  /** Board code, e.g. `600519`. */
  readonly code: string
  /** Display name, e.g. `贵州茅台`. */
  readonly name: string
  /** Market label, e.g. `沪A` / `深A`. */
  readonly marketLabel: string
  /** Last price when a quote summary was merged in. */
  readonly price?: number
  /** Change percentage when a quote summary was merged in. */
  readonly changePct?: number
}

function decodeGbk(buffer: ArrayBuffer): string {
  return new TextDecoder('gbk').decode(buffer)
}

/** Decode Tencent smartbox's literal `\uXXXX` escapes into real characters. */
function decodeUnicodeEscapes(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/gu, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
}

/** Parse one Tencent smartbox body; only A-share entries are kept. */
export function parseTencentHints(text: string): readonly EmSuggestion[] {
  const payload = /"(.*)"/u.exec(text)?.[1] ?? ''
  return payload.split('^').flatMap((entry): EmSuggestion[] => {
    if (entry.trim() === '') return []
    const fields = entry.split('~')
    const market = fields[0]?.toLowerCase() ?? ''
    const code = fields[1] ?? ''
    const kind = fields[4] ?? ''
    const labels: Record<string, string> = { sh: '沪A', sz: '深A', bj: '北A', hk: '港股', us: '美股' }
    if (market === 'hk' && kind === 'GP') return [{ code: `hk${code}`, name: decodeUnicodeEscapes(fields[2] ?? code), marketLabel: labels.hk! }]
    if (market === 'us' && kind === 'GP') return [{ code: `us${code}`, name: decodeUnicodeEscapes(fields[2] ?? code), marketLabel: labels.us! }]
    if (/^(sh|sz)$/.test(market) && kind === 'ETF') return [{ code, name: decodeUnicodeEscapes(fields[2] ?? code), marketLabel: market === 'sh' ? 'ETF·沪' : 'ETF·深' }]
    if (!/^(sh|sz|bj)$/u.test(market) || !(kind === 'GP-A' || kind === 'GP')) return []
    return [{ code, name: decodeUnicodeEscapes(fields[2] ?? code), marketLabel: (labels as Record<string, string>)[market] ?? '' }]
  })
}

/** Parse one Eastmoney suggest body (JSON or JSONP-wrapped). */
export function parseEmSuggestions(text: string): readonly EmSuggestion[] {
  const jsonText = /^\s*jQuery[^\(]*\(/u.test(text) ? text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')) : text
  const body = JSON.parse(jsonText) as { QuotationCodeTable?: { Data?: unknown } }
  const table = body.QuotationCodeTable
  const data = table instanceof Object && Array.isArray(table.Data) ? table.Data : []
  return data.flatMap((entry): EmSuggestion[] => {
    if (!(entry instanceof Object)) return []
    const raw = entry as Record<string, unknown>
    const code = typeof raw.Code === 'string' ? raw.Code : undefined
    const name = typeof raw.Name === 'string' ? raw.Name : undefined
    if (code === undefined || !/^\d{6}$/u.test(code)) return []
    return [{
      code,
      name: name ?? code,
      marketLabel: typeof raw.SecurityTypeName === 'string' ? raw.SecurityTypeName : '',
    }]
  })
}

/**
 * Search A-share symbols by name, pinyin or code prefix.
 * @param query - user input.
 * @param fetchImpl - Injectable fetch for tests.
 * @returns Up to ten suggestions, or the failure reason.
 */
export async function searchEmStocks(query: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; value: readonly EmSuggestion[] } | { ok: false; error: string }> {
  const trimmed = query.trim()
  if (trimmed === '') return { ok: true, value: [] }
  const headers = { ...BROWSER_HEADERS }
  const attempts: { name: string; run: () => Promise<readonly EmSuggestion[]> }[] = [
    {
      name: 'tencent',
      run: async () => {
        const response = await fetchImpl(`https://smartbox.gtimg.cn/s3/?v=2&q=${encodeURIComponent(trimmed)}&t=all`, { headers })
        if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
        return parseTencentHints(decodeGbk(await response.arrayBuffer()))
      },
    },
    {
      name: 'eastmoney',
      run: async () => {
        const url = 'https://searchapi.eastmoney.com/api/suggest/get'
          + `?input=${encodeURIComponent(trimmed)}&type=14&count=10`
        const response = await fetchImpl(url, { headers: { ...headers, 'x-requested-with': 'XMLHttpRequest', referer: 'https://quote.eastmoney.com/' } })
        if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
        return parseEmSuggestions(await response.text())
      },
    },
  ]
  let lastError = 'no search source answered'
  for (const attempt of attempts) {
    try {
      const value = await attempt.run()
      if (value.length > 0) return { ok: true, value }
      lastError = `${attempt.name}: no match`
    } catch (error: unknown) {
      lastError = `${attempt.name}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  return { ok: false, error: lastError }
}

/**
 * Rename provider-echoed codes back to the stored watchlist symbols and drop
 * rows the watchlist did not ask for.
 */
function alignRows(rows: readonly EmQuote[], codes: readonly string[]): readonly EmQuote[] {
  const map = new Map(codes.flatMap((symbol) => {
    const provider = providerCodeOf(symbol)
    return provider === undefined ? [] : [[provider, symbol] as const]
  }))
  return rows.flatMap((row): EmQuote[] => {
    const stored = map.get(row.code)
    if (stored === undefined) return []
    return [stored === row.code ? row : { ...row, code: stored }]
  })
}
