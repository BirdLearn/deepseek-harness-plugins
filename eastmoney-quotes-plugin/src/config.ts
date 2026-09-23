/** Plugin configuration: the editable watchlist symbol string and quote source. */
import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Quote source selection. `api` forces the self-hosted quotes service. */
export type QuoteSourceChoice = 'auto' | 'api' | 'eastmoney' | 'tencent' | 'sina'

/**
 * Optional self-hosted quotes service, e.g. `http://1.14.153.177:8989`.
 * When `apiBaseUrl` and `apiKey` are both set, `source: auto` tries it first.
 */
export interface ApiOptions {
  readonly apiBaseUrl: string
  readonly apiKey: string
}

/** Validated plugin configuration received by {@link apply}. Volatile fields are live references — read `.get()` per operation. */
export interface Config {
  /** Comma- or whitespace-separated watchlist codes; `sh`/`sz`/`bj` prefixes are optional. */
  symbols: Volatile<string>
  /** Quote source; `auto` tries the configured API service, then Eastmoney, Tencent, Sina. */
  source: Volatile<QuoteSourceChoice>
  /** Base URL of the self-hosted quotes service; empty disables it. */
  apiBaseUrl: Volatile<string>
  /** `X-API-Key` sent to the self-hosted quotes service. */
  apiKey: Volatile<string>
}

export const Config = z.object({
  symbols: z.string().volatile().default('600519,000001,300750'),
  source: z.union(['auto', 'api', 'eastmoney', 'tencent', 'sina'] as const).volatile().default('auto'),
  apiBaseUrl: z.string().volatile().default(''),
  apiKey: z.string().volatile().default(''),
})
