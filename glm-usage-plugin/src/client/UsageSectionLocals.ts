/** Window helpers shared by the section panel and the compact indicators. */
import type { UsageKey } from './locales.ts'

/** One quota window as rendered anywhere in the plugin. */
export interface UsageWindow {
  /** Platform window kind, e.g. `CREDIT_LIMIT`. */
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

/** Localized display name for one quota window. */
export function windowLabel(unit: number | undefined, number: number | undefined, t: (key: UsageKey) => string): string {
  if (number === 5) return t('totalWindow')
  if (unit === 6) return t('weeklyWindow')
  return t('otherWindow')
}
