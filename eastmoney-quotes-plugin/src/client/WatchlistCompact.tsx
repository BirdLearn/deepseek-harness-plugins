/** Composer candlestick icon with a hover card listing the sorted watchlist. */
import { useState, type ReactElement } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { QuotesSnapshot } from './QuotesSection.tsx'

/** Operations injected into the composer indicator. */
export interface QuotesRingInjected {
  /** Refresh quotes; called on every hover. */
  refresh: () => Promise<void>
  /** Quotes snapshot source; the renderer binds `useQuotes`. */
  hooks: { quotes: { getSnapshot(): QuotesSnapshot; subscribe(listener: () => void): () => void } }
}

/** Composed icon props. */
export interface QuotesRingProps {
  /** Reactive snapshot reader. */
  useQuotes: <S>(selector: (snapshot: QuotesSnapshot) => S) => S
  /** Refresh quotes. */
  refresh: () => Promise<void>
}

function changeColor(value: number | undefined): string {
  if (value === undefined || value === 0) return 'var(--dsw-alias-label-secondary, gray)'
  return value > 0 ? 'var(--emq-up, #e03131)' : 'var(--emq-down, #2f9e44)'
}

/** Minimal candlestick-chart glyph (lucide-style, currentColor stroke). */
function CandlestickIcon({ size }: { size: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5v4" />
      <rect width="4" height="6" x="7" y="9" rx="1" />
      <path d="M9 15v2" />
      <path d="M17 3v2" />
      <rect width="4" height="6" x="15" y="5" rx="1" />
      <path d="M17 11v5" />
      <path d="M3 21h18" />
    </svg>
  )
}

/** Display code in exchange style: `hk00100` → `00100.HK`, `600519` → `600519.SH`(已知市场) or plain. */
function displayCode(code: string): string {
  if (code.startsWith('hk')) return `${code.slice(2)}.HK`
  if (code.startsWith('sz')) return `${code.slice(2)}.SZ`
  if (code.startsWith('sh')) return `${code.slice(2)}.SH`
  if (code.startsWith('bj')) return `${code.slice(2)}.BJ`
  if (code.startsWith('us')) return code.slice(2)
  return code
}

/** Hover card: sorted watchlist with name, exchange-style code, price and change pill. */
function QuotesCard({ useQuotes, refresh }: { useQuotes: QuotesRingProps['useQuotes']; refresh: () => Promise<void> }): ReactElement {
  const quotes = useQuotes((snapshot) => snapshot)
  const rows = [...quotes.rows].sort((a, b) => (b.changePct ?? -999) - (a.changePct ?? -999))
  return (
    <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 40, minWidth: 210,
      borderRadius: 12, overflow: 'hidden',
      background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-primary, #fff))',
      border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
      boxShadow: '0 12px 32px rgba(0,0,0,0.16)', textAlign: 'left' }}
      onClick={(event) => { event.stopPropagation() }}>
      <div>
        {rows.map((row) => {
          const up = (row.changePct ?? 0) >= 0
          return (
            <div key={row.code} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 12px' }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, flexShrink: 0, background: changeColor(row.changePct) }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--dsw-alias-label-primary, inherit)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {row.name ?? row.code}
              </span>
              <span style={{ fontSize: 10, color: 'var(--dsw-alias-label-tertiary, gray)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayCode(row.code)}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--dsw-alias-label-primary, inherit)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {row.price === undefined ? '—' : row.price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {row.changePct === undefined
                ? null
                : (
                    <span style={{ minWidth: 56, textAlign: 'center', fontSize: 10.5, fontWeight: 600, padding: '1px 6px',
                      borderRadius: 999, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                      background: up ? 'rgba(224,49,49,0.1)' : 'rgba(47,158,68,0.1)', color: changeColor(row.changePct) }}>
                      {`${up ? '∧' : '∨'} ${row.changePct > 0 ? '+' : ''}${String(row.changePct)}%`}
                    </span>
                  )}
            </div>
          )
        })}
        {rows.length === 0
          ? <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary, gray)' }}>
              {quotes.failed === true ? (quotes.failure ?? '—') : quotes.loading ? '…' : '—'}
            </div>
          : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
        borderTop: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.12))',
        background: 'var(--dsw-alias-bg-quaternary, rgba(128,128,128,0.05))', fontSize: 10, color: 'var(--dsw-alias-label-secondary, gray)' }}>
        <StateDot state={quotes.failed ? 'error' : quotes.loading ? 'ongoing' : 'done'} size={6} />
        {`已同步 ${quotes.fetchedAt === undefined ? '—' : new Date(quotes.fetchedAt).toLocaleTimeString()} · 完整行情见 设置 → 自选行情`}
      </div>
    </div>
  )
}

/** Composer icon: candlestick glyph; hover refreshes and shows the sorted watchlist card. */
export function ComposerQuotesRing({ useQuotes, refresh }: QuotesRingProps): ReactElement {
  const quotes = useQuotes((snapshot) => snapshot)
  const [hover, setHover] = useState(false)
  const failing = quotes.failed && !quotes.loading
  return (
    <div style={{ position: 'relative' }}
      onPointerEnter={() => { setHover(true); void refresh() }}
      onPointerLeave={() => { setHover(false) }}
      onClick={() => { void refresh() }}>
      <div title="自选盯盘"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
          borderRadius: 6, cursor: 'pointer', color: failing ? 'var(--dsw-alias-status-critical, #d5494c)' : 'var(--dsw-alias-label-secondary, gray)' }}>
        <CandlestickIcon size={17} />
      </div>
      {hover ? <QuotesCard useQuotes={useQuotes} refresh={refresh} /> : null}
    </div>
  )
}
