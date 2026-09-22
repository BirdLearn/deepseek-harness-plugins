/** GLM Coding Plan quota query client for the Host face. */

/** One quota window inside the coding plan. */
export interface GlmQuotaWindow {
  /** Window kind as reported by the platform, e.g. `CREDIT_LIMIT`. */
  readonly type: string
  /** Platform unit code; 3 pairs with the 5-hour window, 6 with the weekly window. */
  readonly unit?: number
  /** Window length in the platform's unit, e.g. 5 for the rolling 5-hour window. */
  readonly number?: number
  /** Used percentage as reported by the platform. */
  readonly percentage: number
  /** Consumed amount in the window's unit. */
  readonly currentValue: number
  /** Total allowance for the window. */
  readonly usage: number
  /** Remaining allowance when the platform reports it. */
  readonly remaining?: number
  /** Millisecond epoch when the window resets; absent when the platform omits it. */
  readonly nextResetTime?: number
}

/** Full quota snapshot returned for one API key. */
export interface GlmQuotaSnapshot {
  /** Plan level name, e.g. `pro`, `max`, `lite`. */
  readonly level: string
  /** Quota windows in platform order. */
  readonly limits: readonly GlmQuotaWindow[]
  /** Millisecond epoch when this snapshot was fetched. */
  readonly fetchedAt: number
}

/** Failure reasons surfaced by {@link fetchGlmQuota}. */
export type GlmQuotaFailure =
  | { readonly kind: 'http'; readonly status: number; readonly message: string }
  | { readonly kind: 'network'; readonly message: string }
  | { readonly kind: 'unauthorized'; readonly message: string }
  | { readonly kind: 'shape'; readonly message: string }

export type GlmQuotaResult = { readonly ok: true; readonly value: GlmQuotaSnapshot } | { readonly ok: false; readonly error: GlmQuotaFailure }

interface RawLimit {
  type?: unknown
  unit?: unknown
  number?: unknown
  percentage?: unknown
  currentValue?: unknown
  usage?: unknown
  remaining?: unknown
  nextResetTime?: unknown
}

interface RawQuotaBody {
  level?: unknown
  limits?: unknown
  data?: RawQuotaBody
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Parse one platform quota body, tolerating the `{ data: ... }` wrapper. */
export function parseGlmQuota(body: unknown): GlmQuotaSnapshot {
  const source = (body instanceof Object && 'data' in body && body.data instanceof Object ? (body as RawQuotaBody).data : body) as RawQuotaBody
  if (!Array.isArray(source.limits)) {
    throw new Error('quota response has no limits array')
  }
  const limits = source.limits.flatMap((entry): GlmQuotaWindow[] => {
    if (!(entry instanceof Object)) return []
    const raw = entry as RawLimit
    const type = asString(raw.type)
    const percentage = asNumber(raw.percentage)
    const currentValue = asNumber(raw.currentValue) ?? 0
    const usage = asNumber(raw.usage) ?? 0
    if (type === undefined || percentage === undefined) return []
    const nextResetTime = asNumber(raw.nextResetTime)
    const unit = asNumber(raw.unit)
    const number = asNumber(raw.number)
    const remaining = asNumber(raw.remaining)
    return [{
      type,
      percentage,
      currentValue,
      usage,
      ...(unit === undefined ? {} : { unit }),
      ...(number === undefined ? {} : { number }),
      ...(remaining === undefined ? {} : { remaining }),
      ...(nextResetTime === undefined ? {} : { nextResetTime }),
    }]
  })
  return { level: asString(source.level) ?? 'unknown', limits, fetchedAt: Date.now() }
}

/**
 * Query the coding plan quota for one API key.
 * @param baseUrl - Platform origin, e.g. `https://api.z.ai` or `https://open.bigmodel.cn`.
 * @param apiKey - Bare platform API key, sent without a Bearer prefix.
 * @param fetchImpl - Injectable fetch for tests.
 * @returns The parsed snapshot, or the classified failure.
 */
export async function fetchGlmQuota(baseUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<GlmQuotaResult> {
  const url = `${baseUrl.replace(/\/+$/u, '')}/api/monitor/usage/quota/limit`
  let response: Response
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: apiKey, 'Content-Type': 'application/json', 'Accept-Language': 'en-US,en' },
    })
  } catch (error: unknown) {
    return { ok: false, error: { kind: 'network', message: error instanceof Error ? error.message : String(error) } }
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: { kind: 'unauthorized', message: `platform rejected the API key (HTTP ${String(response.status)})` } }
  }
  if (!response.ok) {
    return { ok: false, error: { kind: 'http', status: response.status, message: `quota endpoint answered HTTP ${String(response.status)}` } }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch (error: unknown) {
    return { ok: false, error: { kind: 'shape', message: error instanceof Error ? error.message : String(error) } }
  }
  try {
    return { ok: true, value: parseGlmQuota(body) }
  } catch (error: unknown) {
    return { ok: false, error: { kind: 'shape', message: error instanceof Error ? error.message : String(error) } }
  }
}
