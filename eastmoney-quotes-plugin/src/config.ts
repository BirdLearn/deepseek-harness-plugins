/** Plugin configuration: the editable watchlist symbol string and quote source. */
import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Quote source selection. */
export type QuoteSourceChoice = 'auto' | 'eastmoney' | 'tencent' | 'sina'

/** Validated plugin configuration received by {@link apply}. Volatile fields are live references — read `.get()` per operation. */
export interface Config {
  /** Comma- or whitespace-separated watchlist codes; `sh`/`sz`/`bj` prefixes are optional. */
  symbols: Volatile<string>
  /** Quote source; `auto` tries Eastmoney, then Tencent, then Sina. */
  source: Volatile<QuoteSourceChoice>
}

export const Config = z.object({
  symbols: z.string().volatile().default('600519,000001,300750'),
  source: z.union(['auto', 'eastmoney', 'tencent', 'sina'] as const).volatile().default('auto'),
})
