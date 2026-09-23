/** Composer candlestick trigger with a click-open, anchored watchlist panel —
 * mirroring the ContextMeter interaction (click toggle, portal panel, outside
 * pointer / Escape dismiss). */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { StateDot, useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { QuotesSnapshot } from './QuotesSection.tsx'
import type { QuotesKey } from './locales.ts'

/** Operations injected into the composer indicator. */
export interface QuotesRingInjected {
  /** Refresh quotes; called when the panel opens. */
  refresh: () => Promise<void>
  /** Quotes snapshot source; the renderer binds `useQuotes`. */
  hooks: { quotes: { getSnapshot(): QuotesSnapshot; subscribe(listener: () => void): () => void } }
}

/** Composed icon props. */
export interface QuotesRingProps {
  /** Localized copy. */
  t: (key: QuotesKey) => string
  /** Reactive snapshot reader. */
  useQuotes: <S>(selector: (snapshot: QuotesSnapshot) => S) => S
  /** Refresh quotes. */
  refresh: () => Promise<void>
}

const CSS = `
.emqs-root { display: inline-flex; flex: none; }
.emqs-trigger { display: inline-flex; align-items: center; gap: 6px; flex: none; padding: 1px 8px;
  border: none; border-radius: 24px; background: transparent; color: var(--dsw-alias-label-tertiary);
  font-family: inherit; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; cursor: pointer; }
.emqs-trigger:hover, .emqs-trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.emqs-panel { position: fixed; z-index: 1100; box-sizing: border-box; width: min(300px, calc(100vw - 24px));
  padding: 12px; border: 0; border-radius: 12px; background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  box-shadow: var(--dsw-elevation-prominent); font-size: 12px; line-height: 20px;
  color: var(--dsw-alias-label-secondary); cursor: default; }
.emqs-head { display: flex; align-items: center; gap: 6px; }
.emqs-title { font-weight: 600; color: var(--dsw-alias-label-primary); }
.emqs-pill { font-size: 10px; font-weight: 500; padding: 0 7px; border-radius: 999px;
  background: var(--dsw-alias-bg-quaternary, rgba(128,128,128,0.1)); color: var(--dsw-alias-label-secondary); }
.emqs-refresh { margin-left: auto; border: none; background: transparent; cursor: pointer; font-size: 12px;
  color: var(--dsw-alias-label-secondary); padding: 1px 5px; border-radius: 5px; }
.emqs-refresh:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.emqs-row { display: flex; align-items: center; gap: 7px; padding: 3px 0; }
.emqs-bar { width: 3px; height: 16px; border-radius: 2px; flex-shrink: 0; }
.emqs-name { font-size: 11.5px; font-weight: 600; color: var(--dsw-alias-label-primary); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.emqs-code { font-size: 10px; color: var(--dsw-alias-label-tertiary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emqs-price { font-size: 11.5px; font-weight: 600; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.emqs-chip { min-width: 56px; text-align: center; font-size: 10.5px; font-weight: 600; padding: 1px 6px;
  border-radius: 999px; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.emqs-foot { display: flex; align-items: center; gap: 5px; margin-top: 8px; padding-top: 6px;
  border-top: 1px solid var(--dsw-alias-border-l2); font-size: 10px; color: var(--dsw-alias-label-tertiary); }
.emqs-up { color: var(--dsw-alias-label-primary); font-weight: 600; }
`

/** Change color: A-share red for gains, green for losses. */
/** Solid caret arrow: up when `up`, otherwise flipped. */
function CaretArrow({ up, color }: { up: boolean; color: string }): ReactElement {
  return (
    <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden style={{ flexShrink: 0 }}>
      <path d={up ? 'M4 1 L7.2 6.4 L0.8 6.4 Z' : 'M4 7 L0.8 1.6 L7.2 1.6 Z'} fill={color} />
    </svg>
  )
}

function changeColor(value: number | undefined): string {
  if (value === undefined || value === 0) return 'var(--dsw-alias-label-secondary)'
  return value > 0 ? 'var(--emq-up, #e03131)' : 'var(--emq-down, #2f9e44)'
}

function chipStyle(value: number | undefined): { background: string; color: string } {
  if (value === undefined) return { background: 'transparent', color: 'var(--dsw-alias-label-secondary)' }
  if (value > 0) return { background: 'rgba(224,49,49,0.1)', color: 'var(--emq-up, #e03131)' }
  if (value < 0) return { background: 'rgba(47,158,68,0.1)', color: 'var(--emq-down, #2f9e44)' }
  return { background: 'var(--dsw-alias-interactive-bg-hover)', color: 'var(--dsw-alias-label-secondary)' }
}

/** Minimal candlestick-chart glyph (lucide-style, currentColor stroke). */
function CandlestickIcon(): ReactElement {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
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

/** Display code in exchange style: `hk00100` → `00100.HK`, `600519` → `600519.SH`. */
function displayCode(code: string): string {
  if (code.startsWith('hk')) return `${code.slice(2)}.HK`
  if (code.startsWith('sz')) return `${code.slice(2)}.SZ`
  if (code.startsWith('sh')) return `${code.slice(2)}.SH`
  if (code.startsWith('bj')) return `${code.slice(2)}.BJ`
  if (code.startsWith('us')) return code.slice(2)
  if (code.startsWith('6') || code.startsWith('5')) return `${code}.SH`
  if (code.startsWith('15') || code.startsWith('16') || code.startsWith('18') || code.startsWith('0') || code.startsWith('3')) return `${code}.SZ`
  return code
}

/** Click-open composer indicator: candlestick trigger plus the anchored watchlist panel. */
export function ComposerQuotesRing({ t, useQuotes, refresh }: QuotesRingProps): ReactElement {
  const quotes = useQuotes((snapshot) => snapshot)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const position = useAnchoredPosition({ open, anchorRef: rootRef, panelRef, side: 'top', gap: 8, margin: 12 })
  useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const rows = [...quotes.rows].sort((a, b) => (b.changePct ?? -999) - (a.changePct ?? -999))
  const quoteTime = rows.reduce<number | undefined>((latest, row) => {
    if (row.quoteTime === undefined) return latest
    return latest === undefined || row.quoteTime > latest ? row.quoteTime : latest
  }, undefined)

  return (
    <span ref={rootRef} className="emqs-root">
      <style>{CSS}</style>
      <button
        type="button"
        className="emqs-trigger"
        aria-label={t('nav')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) void refresh()
        }}
      >
        <CandlestickIcon />
      </button>
      {open && createPortal(
        <div ref={panelRef} className="emqs-panel" style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="dialog" aria-label={t('nav')}>
          <div className="emqs-head">
            <StateDot state={quotes.failed ? 'error' : quotes.loading ? 'ongoing' : 'done'} size={8} />
            <span className="emqs-title">{t('nav')}</span>
            <span className="emqs-pill">{`实时 ${String(quotes.rows.length)}`}</span>
            <button type="button" className="emqs-refresh" onClick={() => { void refresh() }}>⟳</button>
          </div>
          <div style={{ marginTop: 6 }}>
            {rows.map((row) => {
              const up = (row.changePct ?? 0) >= 0
              return (
                <div key={row.code} className="emqs-row">
                  <span className="emqs-bar" style={{ background: changeColor(row.changePct) }} />
                  <span className="emqs-name">{row.name ?? row.code}
                    {row.code.startsWith('hk')
                      ? <span title="免费港股源延迟约 15 分钟" style={{ fontSize: 9.5, marginLeft: 5, padding: '0 4px', borderRadius: 4,
                        border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-tertiary)' }}>延时</span>
                      : null}
                  </span>
                  <span className="emqs-code">{displayCode(row.code)}</span>
                  <span className="emqs-price">
                    {row.price === undefined ? '—' : row.price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="emqs-chip" style={chipStyle(row.changePct)}>
                    {row.changePct === undefined
                      ? '—'
                      : (
                          <>
                            <CaretArrow up={up} color={chipStyle(row.changePct).color} />
                            {`${row.changePct > 0 ? '+' : ''}${String(row.changePct)}%`}
                          </>
                        )}
                  </span>
                </div>
              )
            })}
            {rows.length === 0
              ? <div style={{ padding: '4px 0', color: 'var(--dsw-alias-label-tertiary)' }}>
                  {quotes.failed ? (quotes.failure ?? '—') : quotes.loading ? '…' : '—'}
                </div>
              : null}
          </div>
          <div className="emqs-foot">
            <StateDot state={quotes.failed ? 'error' : quotes.loading ? 'ongoing' : 'done'} size={6} />
            {`已同步 ${quotes.fetchedAt === undefined ? '—' : new Date(quotes.fetchedAt).toLocaleTimeString()}`}
            {quoteTime !== undefined ? ` · 行情 ${new Date(quoteTime).toLocaleTimeString()}` : ''}
            {' · 完整行情见 设置 → 自选行情'}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
