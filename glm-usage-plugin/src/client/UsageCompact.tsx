/** Composer GLM usage icon with the detail popup card (mockup style). */
import { useState, type ReactElement } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
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

/** Composed icon props. */
export interface UsageCompactProps {
  /** Localized copy. */
  t: (key: UsageKey) => string
  /** Reactive snapshot reader generated from the injected `hooks.usage`. */
  useUsage: <S>(selector: (snapshot: UsageSnapshot) => S) => S
  /** Request one quota fetch. */
  refresh: () => Promise<void>
}

function tone(pct: number): { color: string; bg: string; label: string } {
  if (pct < 60) return { color: '#2f9e44', bg: 'rgba(47,158,68,0.12)', label: '充足' }
  if (pct < 85) return { color: '#d98a2b', bg: 'rgba(217,138,43,0.12)', label: `已用 ${String(Math.round(pct))}%` }
  return { color: '#e03131', bg: 'rgba(224,49,49,0.1)', label: '额度告急' }
}

function barGradient(pct: number): string {
  if (pct >= 85) return 'linear-gradient(90deg, #d98a2b, #e03131)'
  if (pct >= 60) return 'linear-gradient(90deg, #2f9e44, #d98a2b)'
  return 'linear-gradient(90deg, #2f9e44, #52b788)'
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

/** Popup per window block: title + status tag, thick gradient bar, reset time row. */
function WindowBlock({ window: win, t }: { window: UsageWindow; t: (key: UsageKey) => string }): ReactElement {
  const info = tone(win.percentage)
  const tight = win.percentage >= 60
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary, inherit)' }}>
          {windowLabel(win.unit, win.number, t)}
          <span style={{ fontSize: 10.5, fontWeight: 500, padding: '1px 7px', borderRadius: 999, background: info.bg, color: info.color }}>{info.label}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: 'var(--emq-muted, gray)' }}>
          <b style={{ fontSize: 15, color: tight ? info.color : 'var(--dsw-alias-label-primary, inherit)' }}>{`${String(Math.round(win.percentage))}%`}</b>
          <span>{'·'}</span>
          <span>{`剩余 ${formatCount(win.remaining ?? Math.max(0, win.usage - win.currentValue))} / ${formatCount(win.usage)}`}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 7, background: 'var(--dsw-alias-bg-quaternary, rgba(128,128,128,0.15))' }}>
        <div style={{ height: '100%', width: `${String(Math.min(100, Math.max(0, win.percentage)))}%`,
          background: barGradient(win.percentage), borderRadius: 3, transition: 'width .3s ease' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'var(--emq-muted, gray)' }}>
        <span>{`🕐 ${t('resetAt')} ${win.nextResetTime === undefined ? '—' : new Date(win.nextResetTime).toLocaleString()}`}</span>
        {tight ? <span style={{ color: info.color }}>{t('tight')}</span> : <span>{countdown(win.nextResetTime)}</span>}
      </div>
    </div>
  )
}

/** Composer icon: ring with usage percentage; hover opens the mockup-style popup. */
export function ComposerUsageBadge({ t, useUsage, refresh }: UsageCompactProps): ReactElement {
  const usage = useUsage((snapshot) => snapshot)
  const [hover, setHover] = useState(false)
  const [closed, setClosed] = useState(false)
  const percentage = usage.windows?.[0]?.percentage
  if (usage.unconfigured) return <span />
  const radius = 15 / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(100, Math.max(0, percentage ?? 0))
  return (
    <div style={{ position: 'relative' }}
      onPointerEnter={() => { setHover(true); setClosed(false); void refresh() }}
      onPointerLeave={() => { setHover(false) }}
      onClick={() => { void refresh() }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', cursor: 'pointer' }}>
        <svg width={17} height={17} viewBox="0 0 17 17" aria-hidden>
          <circle cx="8.5" cy="8.5" r={radius} fill="none" strokeWidth={3} stroke="var(--dsw-alias-bg-quaternary, rgba(128,128,128,0.2))" />
          <circle cx="8.5" cy="8.5" r={radius} fill="none" strokeWidth={3} strokeLinecap="round"
            stroke={percentage !== undefined && percentage >= 85 ? '#e03131' : percentage !== undefined && percentage >= 60 ? '#d98a2b' : '#2f9e44'}
            strokeDasharray={`${String(circumference * pct / 100)} ${String(circumference)}`} strokeDashoffset={circumference / 4} />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dsw-alias-label-secondary, gray)' }}>GLM</span>
        {percentage !== undefined ? <span style={{ fontSize: 10, color: 'var(--dsw-alias-label-tertiary, gray)' }}>{`${String(percentage)}%`}</span> : null}
      </div>
      {hover && !closed
        ? (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 40, width: 340,
              borderRadius: 12, overflow: 'hidden', cursor: 'default',
              background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-primary, #fff))',
              border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
              boxShadow: '0 12px 32px rgba(0,0,0,0.16)', textAlign: 'left' }}
              onClick={(event) => { event.stopPropagation() }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <StateDot state={usage.failed ? 'error' : usage.loading ? 'ongoing' : 'done'} size={9} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--dsw-alias-label-primary, inherit)' }}>{t('title')}</span>
                  {usage.level !== undefined
                    ? <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 8px', borderRadius: 999,
                      background: 'rgba(47,158,68,0.12)', color: '#2f9e44' }}>{usage.level.toUpperCase()}</span>
                    : null}
                </div>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <button type="button" title={t('refresh')} onClick={() => { void refresh() }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--dsw-alias-label-secondary, gray)', padding: '2px 5px', borderRadius: 5 }}>⟳</button>
                  <button type="button" title="关闭" onClick={() => { setClosed(true) }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--dsw-alias-label-secondary, gray)', padding: '2px 5px', borderRadius: 5 }}>✕</button>
                </span>
              </div>
              <div style={{ padding: '2px 16px 8px', display: 'flex', flexDirection: 'column' }}>
                {usage.windows?.map((win) => <WindowBlock key={win.type} window={win} t={t} />)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, gray)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <StateDot state={usage.failed ? 'error' : usage.loading ? 'ongoing' : 'done'} size={7} />
                  {`更新于 ${usage.fetchedAt === undefined ? '—' : new Date(usage.fetchedAt).toLocaleTimeString()}`}
                </span>
              </div>
            </div>
          )
        : null}
    </div>
  )
}
