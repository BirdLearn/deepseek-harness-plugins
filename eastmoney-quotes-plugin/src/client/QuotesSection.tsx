/** Settings section rendering the Eastmoney watchlist as a quotes table. */
import { useState, type ReactElement } from 'react'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { EmQuote } from '../em-api.ts'
import type { QuotesKey } from './locales.ts'
import { SearchBox } from './SearchBox.tsx'

/** Latest watchlist state observed by the apply closure. */
export interface QuotesSnapshot {
  /** First load in flight. */
  loading: boolean
  /** Latest fetch failed. */
  failed: boolean
  /** Failure diagnostics from the Host. */
  failure?: string
  /** Watchlist codes the Host requested. */
  codes: readonly string[]
  /** Quote rows in request order. */
  rows: readonly EmQuote[]
  /** Millisecond epoch of the last successful fetch. */
  fetchedAt?: number
  /** Last request round-trip in milliseconds. */
  delayMs?: number
}

/** Operations injected into the section component. */
export interface QuotesInjected {
  /** @returns after one quotes fetch. */
  refresh: () => Promise<void>
  /** @returns suggestions with a live quote summary for one query. */
  search: (query: string) => Promise<readonly SuggestionWithQuote[]>
  /** Add one symbol to the watchlist. */
  add: (symbol: string) => Promise<void>
  /** Remove one symbol from the watchlist. */
  remove: (symbol: string) => Promise<void>
  /** Persist a new watchlist order. */
  reorder: (order: readonly string[]) => Promise<void>
  /** Quotes snapshot source; the renderer binds `useQuotes`. */
  hooks: { quotes: { getSnapshot(): QuotesSnapshot; subscribe(listener: () => void): () => void } }
}

/** One search suggestion carrying a live quote summary. */
export interface SuggestionWithQuote {
  code: string
  name: string
  marketLabel: string
  price?: number
  changePct?: number
}

/** Section props as composed from the registration shares. */
export interface QuotesSectionProps {
  /** Localized copy from the `em.quotes` namespace. */
  t: (key: QuotesKey) => string
  /** Reactive snapshot reader generated from the injected `hooks.quotes`. */
  useQuotes: <S>(selector: (snapshot: QuotesSnapshot) => S) => S
  /** Request one refresh. */
  refresh: () => Promise<void>
  /** @returns suggestions with a live quote summary for one query. */
  search: (query: string) => Promise<readonly SuggestionWithQuote[]>
  /** Add one symbol to the watchlist. */
  add: (symbol: string) => Promise<void>
  /** Remove one symbol from the watchlist. */
  remove: (symbol: string) => Promise<void>
  /** Persist a new watchlist order. */
  reorder: (order: readonly string[]) => Promise<void>
}

/** Section stylesheet: hover states and table polish need real CSS, not inline styles. */
const CSS = `
.emq-root { --emq-up: #e03131; --emq-down: #2f9e44; --emq-muted: var(--dsw-alias-label-secondary, gray); --emq-faint: var(--dsw-alias-label-tertiary, gray);
  display: flex; flex-direction: column; gap: 10px; padding: 12px 16px 16px; min-width: 0; }
.emq-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.emq-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); }
.emq-pill { font-size: 10px; font-weight: 500; padding: 1px 7px; border-radius: 999px; color: var(--emq-muted);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25)); }
.emq-meta { font-size: 11px; color: var(--emq-faint); }
.emq-tabs { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.emq-tab { font-size: 12px; padding: 3px 12px; border-radius: 999px; cursor: pointer; border: 1px solid transparent;
  background: transparent; color: var(--emq-muted); }
.emq-tab:hover { color: var(--dsw-alias-label-primary, inherit); }
.emq-tab[data-active='true'] { background: var(--dsw-alias-label-primary, #1c1c1c); color: var(--dsw-alias-bg-primary, #fff); font-weight: 500; }
.emq-card { border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.18)); border-radius: 10px; overflow: hidden; }
.emq-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.12)); }
.emq-card-title { font-size: 12.5px; font-weight: 600; color: var(--dsw-alias-label-primary, inherit); display: flex; align-items: center; gap: 6px; }
.emq-hint { font-size: 11px; color: var(--emq-faint); }
.emq-scroll { overflow-x: auto; }
.emq-table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.emq-table th { font-size: 11px; font-weight: 500; color: var(--emq-muted); text-align: right; padding: 7px 12px;
  background: var(--dsw-alias-bg-quaternary, rgba(128,128,128,0.08)); white-space: nowrap; }
.emq-table td { font-size: 12.5px; text-align: right; padding: 8px 12px; white-space: nowrap;
  color: var(--dsw-alias-label-primary, inherit); border-top: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.12)); }
.emq-table th:first-child, .emq-table td:first-child { text-align: left; padding-left: 14px; }
.emq-table th:nth-child(2), .emq-table td:nth-child(2) { text-align: left; }
.emq-table tbody tr:hover td { background: var(--dsw-alias-interactive-bg-hover-accent, rgba(128,128,128,0.07)); }
.emq-badge { display: inline-block; font-size: 10px; padding: 0 6px; border-radius: 4px; margin-left: 6px; vertical-align: 1px; }
.emq-code { color: var(--emq-muted); font-size: 11px; }
.emq-name { font-weight: 600; }
.emq-price { font-weight: 600; }
.emq-chip { display: inline-block; min-width: 52px; text-align: center; padding: 1px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 500; }
.emq-op { border: none; background: transparent; color: var(--emq-faint); cursor: pointer; font-size: 12px; line-height: 1;
  padding: 2px 5px; border-radius: 4px; opacity: 0; transition: opacity .12s ease, color .12s ease; }
.emq-table tbody tr:hover .emq-op { opacity: 1; }
.emq-op:hover { color: var(--dsw-alias-label-primary, inherit); }
.emq-op[data-kind='del']:hover { color: var(--emq-up); }
.emq-add { border-top: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.12)); padding: 10px 14px;
  display: flex; flex-direction: column; gap: 6px; background: var(--dsw-alias-bg-quaternary, rgba(128,128,128,0.05)); }
.emq-add-label { font-size: 11px; color: var(--emq-muted); font-weight: 600; }
.emq-input { width: 100%; box-sizing: border-box; padding: 7px 12px; font-size: 12.5px; border-radius: 8px; outline: none;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3)); background: transparent; color: var(--dsw-alias-label-primary, inherit); }
.emq-input::placeholder { color: var(--emq-faint); }
.emq-input:focus { border-color: var(--dsw-static-deepseek-100, #4d6bfe); }
.emq-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.emq-chipbtn { font-size: 11px; padding: 2px 10px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25)); background: transparent; color: var(--emq-muted); }
.emq-chipbtn[data-active='true'] { background: var(--dsw-alias-label-primary, #1c1c1c); color: var(--dsw-alias-bg-primary, #fff); border-color: transparent; }
.emq-sugg { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 8px; }
.emq-sugg:hover, .emq-sugg[data-active='true'] { background: var(--dsw-alias-interactive-bg-hover-accent, rgba(128,128,128,0.08)); }
.emq-sugg-btn { border: none; background: var(--dsw-alias-label-primary, #1c1c1c); cursor: pointer;
  font-size: 11px; padding: 3px 12px; border-radius: 999px; color: var(--dsw-alias-bg-primary, #fff); flex-shrink: 0; }
.emq-sugg-btn:disabled { cursor: default; background: transparent; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3)); color: var(--emq-faint); }
.emq-note { font-size: 12px; color: var(--emq-muted); }
.emq-error { font-size: 12px; color: var(--dsw-alias-status-critical, #d5494c); }
`

type TabKey = 'all' | 'a' | 'hkus'

interface MarketInfo {
  readonly label: string
  readonly color: string
  readonly group: 'a' | 'hkus'
}

/** Market badge for one stored symbol (A-share digits, `hk…`, `us…`). */
export function marketInfo(code: string, name: string): MarketInfo {
  if (code.startsWith('hk')) return { label: '港股', color: '#7c5cd6', group: 'hkus' }
  if (code.startsWith('us')) return { label: '美股', color: '#d98a2b', group: 'hkus' }
  if (code.startsWith('688') || code.startsWith('689')) return { label: '科创', color: '#3b7dd8', group: 'a' }
  if (code.startsWith('300') || code.startsWith('301')) return { label: '创业', color: '#3b7dd8', group: 'a' }
  if (code.startsWith('60')) return { label: '沪A', color: '#c24042', group: 'a' }
  if (code.startsWith('8') || code.startsWith('4') || code.startsWith('92')) return { label: '北A', color: '#8a6d3b', group: 'a' }
  if (code.startsWith('0')) return { label: '深A', color: '#3b8a68', group: 'a' }
  if (name.endsWith('-W')) return { label: 'W', color: '#7c5cd6', group: 'hkus' }
  return { label: '—', color: 'gray', group: 'a' }
}

function changeColor(value: number | undefined): string {
  if (value === undefined || value === 0) return 'var(--emq-muted)'
  return value > 0 ? 'var(--emq-up)' : 'var(--emq-down)'
}

function formatThousands(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatAmount(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}万`
  return String(Math.round(value))
}

/** Whether the Shanghai/Shenzhen market is in a trading session (Beijing time, Mon–Fri). */
function isTradingNow(): boolean {
  const now = new Date(Date.now() + 480 * 60_000)
  const day = now.getUTCDay()
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  if (day === 0 || day === 6) return false
  const session = (start: number, end: number): boolean => minutes >= start && minutes < end
  return session(570, 690) || session(780, 900)
}

function pctBadge(value: number | undefined, suspended: string): ReactElement {
  if (value === undefined) return <span style={{ color: 'var(--emq-muted)' }}>{suspended}</span>
  return (
    <span className="emq-chip" style={{ color: changeColor(value),
      background: value > 0 ? 'rgba(224,49,49,0.1)' : value < 0 ? 'rgba(47,158,68,0.1)' : 'transparent' }}>
      {`${value > 0 ? '+' : ''}${String(value)}%`}
    </span>
  )
}

function num(value: number | undefined, suspended: string): string {
  return value === undefined ? suspended : formatThousands(value)
}

/** Eastmoney watchlist settings section: monitoring matrix, tabs, search-to-add, reorder and removal. */
export function QuotesSection({ t, useQuotes, refresh, search, add, remove, reorder }: QuotesSectionProps): ReactElement {
  const quotes = useQuotes((snapshot) => snapshot)
  const [tab, setTab] = useState<TabKey>('all')
  const trading = isTradingNow()

  const move = (index: number, delta: -1 | 1): void => {
    const order = [...quotes.codes]
    const target = index + delta
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    void reorder(order)
  }

  const rows = quotes.rows.filter((row) => {
    const info = marketInfo(row.code, row.name ?? '')
    if (tab === 'a') return info.group === 'a'
    if (tab === 'hkus') return info.group === 'hkus'
    return true
  })
  const aCount = quotes.rows.filter((row) => marketInfo(row.code, row.name ?? '').group === 'a').length
  const hkusCount = quotes.rows.length - aCount

  return (
    <div className="emq-root">
      <style>{CSS}</style>
      <div className="emq-head">
        <div>
          <div className="emq-title">
            <StateDot state={quotes.failed ? 'error' : quotes.loading ? 'ongoing' : 'done'} size={8} />
            <span>{t('title')}</span>
            <span className="emq-pill">Realtime</span>
          </div>
          <div className="emq-meta">
            {`${trading ? t('trading') : t('closed')} · ${t('refreshedAt')} ${quotes.fetchedAt === undefined ? '—' : new Date(quotes.fetchedAt).toLocaleTimeString()}${quotes.delayMs === undefined ? '' : ` · ${t('delay')} <${String(quotes.delayMs)}ms`}`}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void refresh() }}>{t('refresh')}</Button>
      </div>
      <div className="emq-tabs">
        {([['all', `${t('tabAll')} (${String(quotes.rows.length)})`], ['a', `A股 (${String(aCount)})`], ['hkus', `港股/美股 (${String(hkusCount)})`]] as const).map(([key, label]) => (
          <button key={key} type="button" className="emq-tab" data-active={tab === key} onClick={() => { setTab(key) }}>{label}</button>
        ))}
        <span className="emq-hint" style={{ marginLeft: 'auto' }}>{t('legendHint')}</span>
      </div>
      {quotes.failed
        ? <span className="emq-error">{`${t('fetchFailed')}${quotes.failure === undefined ? '' : `: ${quotes.failure}`}`}</span>
        : null}
      {quotes.rows.length > 0
        ? (
            <div className="emq-card">
              <div className="emq-card-head">
                <span className="emq-card-title">{`${t('matrix')} · ${String(quotes.rows.length)}/100`}</span>
                <span className="emq-hint">{t('matrixHint')}</span>
              </div>
              <div className="emq-scroll">
                <table className="emq-table">
                  <thead>
                    <tr>
                      <th>{`${t('name')} / ${t('code')}`}</th>
                      <th>{t('price')}</th>
                      <th>{t('changePct')}</th>
                      <th>{t('changeAmt')}</th>
                      <th>{t('high')}</th>
                      <th>{t('low')}</th>
                      <th>{t('amplitude')}</th>
                      <th>{t('quickActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const index = quotes.codes.indexOf(row.code)
                      const info = marketInfo(row.code, row.name ?? '')
                      const amplitude = row.high !== undefined && row.low !== undefined && row.prevClose !== undefined && row.prevClose !== 0
                        ? Number(((row.high - row.low) / row.prevClose * 100).toFixed(2))
                        : undefined
                      return (
                        <tr key={row.code}>
                          <td>
                            <span className="emq-name">{row.name ?? row.code}</span>
                            <span className="emq-badge" style={{ color: info.color, border: `1px solid ${info.color}` }}>{info.label}</span>
                            <div className="emq-code">{row.code}</div>
                          </td>
                          <td className="emq-price">{row.price === undefined ? t('suspended') : formatThousands(row.price)}</td>
                          <td>{pctBadge(row.changePct, t('suspended'))}</td>
                          <td style={{ color: changeColor(row.changeAmt) }}>
                            {row.changeAmt === undefined ? t('suspended') : `${row.changeAmt > 0 ? '+' : ''}${formatThousands(row.changeAmt)}`}
                          </td>
                          <td>{num(row.high, t('suspended'))}</td>
                          <td>{num(row.low, t('suspended'))}</td>
                          <td>{amplitude === undefined ? t('suspended') : `${String(amplitude)}%`}</td>
                          <td>
                            <button type="button" className="emq-op" title={t('moveUp')} onClick={() => { move(index, -1) }}>↑</button>
                            <button type="button" className="emq-op" title={t('moveDown')} onClick={() => { move(index, 1) }}>↓</button>
                            <button type="button" className="emq-op" data-kind="del" title={t('remove')}
                              onClick={() => { void remove(row.code) }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="emq-card-head" style={{ borderTop: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.12))', borderBottom: 'none' }}>
                <span className="emq-hint">{`当前自选编号：${quotes.codes.join('、')}`}</span>
                <span className="emq-hint">{t('reorderHint')}</span>
              </div>
            </div>
          )
        : null}
      {!quotes.failed && quotes.rows.length === 0
        ? <span className="emq-note">{t('empty')}</span>
        : null}
      <div className="emq-card">
        <div className="emq-card-head">
          <span className="emq-card-title">{t('search')}</span>
          <span className="emq-hint">{t('searchHint')}</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <SearchBox t={t} ops={{ search, symbols: quotes.codes, add }} />
        </div>
      </div>
    </div>
  )
}
