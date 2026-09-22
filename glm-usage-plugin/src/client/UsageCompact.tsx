/** Composer GLM usage trigger with a click-open, anchored quota panel —
 * mirroring the ContextMeter interaction (click toggle, portal panel, outside
 * pointer / Escape dismiss). */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { StateDot, useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UsageKey } from './locales.ts'
import { windowLabel, type UsageWindow } from './UsageSectionLocals.ts'

/** Latest GLM usage state observed by the apply closure. */
export interface UsageSnapshot {
  /** First load in flight. */
  loading: boolean
  /** No credential configured. */
  unconfigured: boolean
  /** Latest fetch failed. */
  failed: boolean
  /** Failure diagnostics from the Host. */
  failure?: string
  /** Plan level, e.g. `pro`. */
  level?: string
  /** Quota windows in platform order. */
  windows?: readonly UsageWindow[]
  /** Millisecond epoch of the last successful fetch. */
  fetchedAt?: number
}

/** Operations injected into the composer indicator. */
export interface UsageInjected {
  /** @returns after one quota fetch. */
  refresh: () => Promise<void>
  /** Usage snapshot source; the renderer binds `useUsage`. */
  hooks: { usage: { getSnapshot(): UsageSnapshot; subscribe(listener: () => void): () => void } }
}

/** Composed trigger props. */
export interface UsageCompactProps {
  /** Localized copy. */
  t: (key: UsageKey) => string
  /** Reactive snapshot reader generated from the injected `hooks.usage`. */
  useUsage: <S>(selector: (snapshot: UsageSnapshot) => S) => S
  /** Request one quota fetch. */
  refresh: () => Promise<void>
}

const CSS = `
.glmu-root { display: inline-flex; flex: none; margin-left: auto; }
.glmu-trigger { display: inline-flex; align-items: center; gap: 6px; flex: none; padding: 1px 8px;
  border: none; border-radius: 24px; background: transparent; color: var(--dsw-alias-label-tertiary);
  font-family: inherit; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; cursor: pointer; }
.glmu-trigger:hover, .glmu-trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.glmu-panel { position: fixed; z-index: 1100; box-sizing: border-box; width: min(320px, calc(100vw - 24px));
  padding: 12px; border: 0; border-radius: 12px; background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  box-shadow: var(--dsw-elevation-prominent); font-size: 12px; line-height: 20px;
  color: var(--dsw-alias-label-secondary); cursor: default; }
.glmu-head { display: flex; align-items: center; gap: 6px; }
.glmu-title { font-weight: 700; color: var(--dsw-alias-label-primary); font-size: 13px; }
.glmu-pill { font-size: 10.5px; font-weight: 600; padding: 1px 8px; border-radius: 999px;
  background: rgba(47,158,68,0.12); color: #2f9e44; }
.glmu-refresh { margin-left: auto; border: none; background: transparent; cursor: pointer; font-size: 13px;
  color: var(--dsw-alias-label-secondary); padding: 1px 5px; border-radius: 5px; }
.glmu-refresh:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.glmu-win { padding: 10px 0 4px; }
.glmu-winhead { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.glmu-winname { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.glmu-tag { font-size: 10.5px; font-weight: 500; padding: 1px 7px; border-radius: 999px; }
.glmu-figures { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12px; }
.glmu-pct { font-size: 15px; font-weight: 600; }
.glmu-bar { height: 6px; border-radius: 3px; overflow: hidden; margin-top: 7px;
  background: var(--dsw-alias-interactive-bg-hover); }
.glmu-fill { height: 100%; border-radius: 3px; transition: width .3s ease; }
.glmu-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; font-size: 11px; }
.glmu-foot { display: flex; align-items: center; gap: 5px; margin-top: 8px; padding-top: 6px;
  border-top: 1px solid var(--dsw-alias-border-l2); font-size: 10px; color: var(--dsw-alias-label-tertiary); }
`

function tone(pct: number): { color: string; bg: string; label: string; gradient: string } {
  if (pct < 60) return { color: '#2f9e44', bg: 'rgba(47,158,68,0.12)', label: '充足', gradient: 'linear-gradient(90deg, #2f9e44, #52b788)' }
  if (pct < 85) return { color: '#d98a2b', bg: 'rgba(217,138,43,0.12)', label: `已用 ${String(Math.round(pct))}%`, gradient: 'linear-gradient(90deg, #2f9e44, #d98a2b)' }
  return { color: '#e03131', bg: 'rgba(224,49,49,0.1)', label: '额度告急', gradient: 'linear-gradient(90deg, #d98a2b, #e03131)' }
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value))
}

function countdown(target: number | undefined): string {
  if (target === undefined) return ''
  const diff = target - Date.now()
  if (diff <= 0) return ''
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  return `约 ${String(hours)}h ${String(minutes)}m 后`
}

/** Panel per window block: name + status tag, figures, gradient bar, reset row. */
function WindowBlock({ window: win, t }: { window: UsageWindow; t: (key: UsageKey) => string }): ReactElement {
  const info = tone(win.percentage)
  const tight = win.percentage >= 60
  return (
    <div className="glmu-win">
      <div className="glmu-winhead">
        <span className="glmu-winname">
          {windowLabel(win.unit, win.number, t)}
          <span className="glmu-tag" style={{ background: info.bg, color: info.color }}>{info.label}</span>
        </span>
        <span className="glmu-figures">
          <span className="glmu-pct" style={{ color: tight ? info.color : 'var(--dsw-alias-label-primary)' }}>{`${String(Math.round(win.percentage))}%`}</span>
          <span>{'·'}</span>
          <span>{`剩余 ${formatCount(win.remaining ?? Math.max(0, win.usage - win.currentValue))} / ${formatCount(win.usage)}`}</span>
        </span>
      </div>
      <div className="glmu-bar">
        <div className="glmu-fill" style={{ width: `${String(Math.min(100, Math.max(0, win.percentage)))}%`, background: info.gradient }} />
      </div>
      <div className="glmu-meta">
        <span>{`🕐 ${t('resetAt')} ${win.nextResetTime === undefined ? '—' : new Date(win.nextResetTime).toLocaleString()}`}</span>
        {tight ? <span style={{ color: info.color }}>{t('tight')}</span> : <span>{countdown(win.nextResetTime)}</span>}
      </div>
    </div>
  )
}

/** Click-open composer trigger: usage ring plus the anchored quota panel. */
export function ComposerUsageBadge({ t, useUsage, refresh }: UsageCompactProps): ReactElement {
  const usage = useUsage((snapshot) => snapshot)
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

  if (usage.unconfigured) return <span />
  const percentage = usage.windows?.[0]?.percentage
  const radius = 6.5
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, percentage ?? 0))

  return (
    <span ref={rootRef} className="glmu-root">
      <style>{CSS}</style>
      <button
        type="button"
        className="glmu-trigger"
        aria-label={t('title')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) void refresh()
        }}
      >
        <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
          <circle cx="7" cy="7" r={radius} fill="none" strokeWidth={2} stroke="var(--dsw-alias-border-l3)" />
          <circle cx="7" cy="7" r={radius} fill="none" strokeWidth={2} strokeLinecap="round"
            stroke={percentage !== undefined && percentage >= 85 ? '#e03131' : percentage !== undefined && percentage >= 60 ? '#d98a2b' : '#2f9e44'}
            strokeDasharray={`${String(circumference * pct / 100)} ${String(circumference)}`} transform="rotate(-90 7 7)" />
        </svg>
        <span>GLM</span>
        {percentage !== undefined ? <span>{`${String(percentage)}%`}</span> : null}
      </button>
      {open && createPortal(
        <div ref={panelRef} className="glmu-panel" style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="dialog" aria-label={t('title')}>
          <div className="glmu-head">
            <StateDot state={usage.failed ? 'error' : usage.loading ? 'ongoing' : 'done'} size={8} />
            <span className="glmu-title">{t('title')}</span>
            {usage.level !== undefined
              ? <span className="glmu-pill">{usage.level.toUpperCase()}</span>
              : null}
            <button type="button" className="glmu-refresh" title={t('refresh')} onClick={() => { void refresh() }}>⟳</button>
          </div>
          {usage.windows?.map((win) => <WindowBlock key={win.type} window={win} t={t} />)}
          <div className="glmu-foot">
            <StateDot state={usage.failed ? 'error' : usage.loading ? 'ongoing' : 'done'} size={6} />
            {`更新于 ${usage.fetchedAt === undefined ? '—' : new Date(usage.fetchedAt).toLocaleTimeString()}`}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
