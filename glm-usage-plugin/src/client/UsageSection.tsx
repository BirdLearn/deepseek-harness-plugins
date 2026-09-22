/** Settings section rendering GLM Coding Plan quota windows as progress bars. */
import type { ReactElement } from 'react'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UsageKey } from './locales.ts'
import { windowLabel as sharedWindowLabel, type UsageWindow } from './UsageSectionLocals.ts'

/** Latest quota state observed by the apply closure. */
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

/** Operations injected into the section component. */
export interface UsageInjected {
  /** @returns after one quota fetch. */
  refresh: () => Promise<void>
  /** Usage snapshot source; the renderer binds `useUsage`. */
  hooks: { usage: { getSnapshot(): UsageSnapshot; subscribe(listener: () => void): () => void } }
}

/** Section props as composed from the registration shares. */
export interface UsageSectionProps {
  /** Localized copy from the `glm.usage` namespace. */
  t: (key: UsageKey) => string
  /** Reactive snapshot reader generated from the injected `hooks.usage`. */
  useUsage: <S>(selector: (snapshot: UsageSnapshot) => S) => S
  /** Request one refresh. */
  refresh: () => Promise<void>
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value))
}

function UsageBar({ percentage }: { percentage: number }): ReactElement {
  const clamped = Math.min(100, Math.max(0, percentage))
  const color = clamped >= 90 ? 'var(--dsw-alias-status-critical, #d5494c)'
    : clamped >= 70 ? 'var(--dsw-alias-status-warning, #d98a2b)'
      : 'var(--dsw-static-deepseek-100, #4d6bfe)'
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--dsw-alias-bg-quaternary, rgba(128,128,128,0.2))', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${String(clamped)}%`, borderRadius: 3, background: color, transition: 'width .3s ease' }} />
    </div>
  )
}

/** One quota window row: label, progress bar, percentage and reset time. */
function WindowRow({ label, percentage, currentValue, usage, remaining, nextResetTime, t }: {
  label: string
  percentage: number
  currentValue: number
  usage: number
  remaining?: number
  nextResetTime?: number
  t: (key: UsageKey) => string
}): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary, inherit)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary, gray)' }}>
          {remaining === undefined
            ? `${String(percentage.toFixed(1))}% · ${formatCount(currentValue)} / ${formatCount(usage)}`
            : `${String(percentage.toFixed(1))}% · ${t('remaining')} ${formatCount(remaining)} / ${formatCount(usage)}`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <UsageBar percentage={percentage} />
        {nextResetTime !== undefined
          ? <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--dsw-alias-label-secondary, gray)' }}>
              {`${t('resetAt')} ${new Date(nextResetTime).toLocaleString()}`}
            </span>
          : null}
      </div>
    </div>
  )
}

/** GLM usage settings section: plan windows, reset times, and a manual refresh. */
export function UsageSection({ t, useUsage, refresh }: UsageSectionProps): ReactElement {
  const usage = useUsage((snapshot) => snapshot)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StateDot
            state={usage.failed ? 'error' : usage.loading ? 'ongoing' : 'done'}
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {usage.level === undefined ? t('title') : `${t('title')} · ${usage.level.toUpperCase()}`}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void refresh() }}>{t('refresh')}</Button>
      </div>
      {usage.loading
        ? <span style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary, gray)' }}>{t('loading')}</span>
        : null}
      {usage.unconfigured
        ? <span style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary, gray)' }}>{t('notConfigured')}</span>
        : null}
      {usage.failed
        ? <span style={{ fontSize: 13, color: 'var(--dsw-alias-status-critical, #d5494c)' }}>
            {`${t('fetchFailed')}${usage.failure === undefined ? '' : `: ${usage.failure}`}`}
          </span>
        : null}
      {usage.windows?.map((entry) => (
        <WindowRow key={entry.type} label={sharedWindowLabel(entry.unit, entry.number, t)} percentage={entry.percentage}
          currentValue={entry.currentValue} usage={entry.usage} remaining={entry.remaining} nextResetTime={entry.nextResetTime} t={t} />
      ))}
      {usage.fetchedAt !== undefined
        ? <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary, gray)' }}>
            {`${t('refreshedAt')} ${new Date(usage.fetchedAt).toLocaleTimeString()}`}
          </span>
        : null}
    </div>
  )
}
