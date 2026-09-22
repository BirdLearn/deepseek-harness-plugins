/** Plugin-owned durable watchlist storage under the Harness home. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

const STORAGE_DIR = ['storages', 'eastmoney-quotes-panel']
const STORAGE_FILE = [...STORAGE_DIR, 'watchlist.json']

/** Stored watchlist document. */
export interface WatchlistDoc {
  /** Ordered board codes. */
  symbols: string[]
}

/** Read the stored watchlist; absent or corrupt storage yields `undefined`. */
export function loadWatchlist(): WatchlistDoc | undefined {
  const file = dshHomePath(...STORAGE_FILE)
  if (!existsSync(file)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<WatchlistDoc>
    if (!Array.isArray(parsed.symbols)) return undefined
    return { symbols: parsed.symbols.filter((symbol): symbol is string => typeof symbol === 'string') }
  } catch {
    return undefined
  }
}

/**
 * Persist the watchlist durably.
 * @param doc - watchlist document to store.
 */
export function saveWatchlist(doc: WatchlistDoc): void {
  const dir = dshHomePath(...STORAGE_DIR)
  mkdirSync(dir, { recursive: true })
  writeFileSync(dshHomePath(...STORAGE_FILE), JSON.stringify(doc, null, 2))
}

/** Current watchlist: stored value wins over the configured default. */
export function currentWatchlist(configured: readonly string[]): string[] {
  return loadWatchlist()?.symbols ?? [...configured]
}

/**
 * Add one symbol if it is new.
 * @returns the updated list.
 */
export function addToWatchlist(configured: readonly string[], symbol: string): string[] {
  const list = currentWatchlist(configured)
  if (!list.includes(symbol)) list.push(symbol)
  saveWatchlist({ symbols: list })
  return list
}

/**
 * Remove one symbol.
 * @returns the updated list.
 */
export function removeFromWatchlist(configured: readonly string[], symbol: string): string[] {
  const list = currentWatchlist(configured).filter((entry) => entry !== symbol)
  saveWatchlist({ symbols: list })
  return list
}

/** Path helper re-export for tests. */
export const watchlistFile = (): string => join(dshHomePath(...STORAGE_FILE))

/**
 * Persist a new watchlist ordering. Unknown symbols are ignored; any current
 * symbol missing from `order` keeps its relative position at the end.
 * @returns the reordered list.
 */
export function reorderWatchlist(configured: readonly string[], order: readonly string[]): string[] {
  const current = currentWatchlist(configured)
  const known = new Set(current)
  const next = order.filter((symbol) => known.has(symbol))
  for (const symbol of current) {
    if (!next.includes(symbol)) next.push(symbol)
  }
  saveWatchlist({ symbols: next })
  return next
}
