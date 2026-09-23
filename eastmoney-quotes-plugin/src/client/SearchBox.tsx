/** Search box: debounced symbol search with market chips, quote summary and keyboard navigation. */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import type { EmSuggestion } from '../em-api.ts'
import type { QuotesKey } from './locales.ts'

/** Search operations injected by the apply closure. */
export interface SearchOps {
  /** @returns suggestions for one query. */
  search: (query: string) => Promise<readonly EmSuggestion[]>
  /** Add one symbol to the watchlist. */
  add: (symbol: string) => Promise<void>
  /** Symbols already on the watchlist. */
  symbols: readonly string[]
}

/** Props of the rendered search box. */
export interface SearchBoxProps {
  /** Localized copy. */
  t: (key: QuotesKey) => string
  /** Search and mutate operations. */
  ops: SearchOps
}

const CSS = `
.emqs-box { display: flex; flex-direction: column; gap: 8px; }
.emqs-row { position: relative; }
.emqs-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--dsw-alias-label-tertiary, gray); pointer-events: none; }
.emqs-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: transparent;
  color: var(--dsw-alias-label-tertiary, gray); cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 4px; }
.emqs-clear:hover { color: var(--dsw-alias-label-primary, inherit); }
.emqs-input { width: 100%; box-sizing: border-box; padding: 8px 28px 8px 30px; font-size: 13px; border-radius: 8px; outline: none;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3)); background: transparent; color: var(--dsw-alias-label-primary, inherit); }
.emqs-input::placeholder { color: var(--dsw-alias-label-tertiary, gray); }
.emqs-input:focus { border-color: var(--dsw-static-deepseek-100, #4d6bfe); }
.emqs-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.emqs-chip { font-size: 11px; padding: 2px 10px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25)); background: transparent; color: var(--dsw-alias-label-secondary, gray); }
.emqs-chip[data-active='true'] { background: var(--dsw-alias-label-primary, #1c1c1c); color: var(--dsw-alias-bg-primary, #fff); border-color: transparent; }
.emqs-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 8px; }
.emqs-item:hover, .emqs-item[data-active='true'] { background: var(--dsw-alias-interactive-bg-hover-accent, rgba(128,128,128,0.08)); }
.emqs-mkt { flex-shrink: 0; width: 34px; text-align: center; font-size: 10.5px; font-weight: 600; padding: 2px 0; border-radius: 6px; color: #fff; }
.emqs-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.emqs-title { font-size: 12.5px; font-weight: 500; color: var(--dsw-alias-label-primary, inherit); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.emqs-title code { font-size: 11px; color: var(--dsw-alias-label-tertiary, gray); margin-left: 6px; }
.emqs-quote { font-size: 11px; color: var(--dsw-alias-label-secondary, gray); display: flex; gap: 8px; font-variant-numeric: tabular-nums; }
.emqs-add { flex-shrink: 0; border: none; background: #4d6bfe; color: #ffffff; cursor: pointer;
  font-size: 12px; font-weight: 600; padding: 4px 16px; border-radius: 999px; letter-spacing: 0.5px; }
.emqs-add:hover:not(:disabled) { background: #3a56e8; }
.emqs-add:disabled { background: transparent; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.35)); color: var(--dsw-alias-label-tertiary, gray); cursor: default; font-weight: 500; }
.emqs-status { font-size: 11px; color: var(--dsw-alias-label-tertiary, gray); }
.emqs-fail { font-size: 11px; color: var(--dsw-alias-status-critical, #d5494c); }
`

type MarketGroup = 'a' | 'hkus' | 'us'

function marketOf(suggestion: EmSuggestion): { label: string; color: string; group: MarketGroup } {
  const code = suggestion.code
  if (code.startsWith('hk')) return { label: '港股', color: '#7c5cd6', group: 'hkus' }
  if (code.startsWith('us')) return { label: '美股', color: '#d98a2b', group: 'us' }
  if (code.startsWith('688') || code.startsWith('689')) return { label: '沪A', color: '#3b7dd8', group: 'a' }
  if (code.startsWith('300') || code.startsWith('301')) return { label: '深A', color: '#3b8a68', group: 'a' }
  if (code.startsWith('60')) return { label: '沪A', color: '#c24042', group: 'a' }
  if (code.startsWith('8') || code.startsWith('4') || code.startsWith('92')) return { label: '北A', color: '#8a6d3b', group: 'a' }
  if (code.startsWith('5')) return { label: '沪基金', color: '#b8860b', group: 'a' }
  if (code.startsWith('15') || code.startsWith('16') || code.startsWith('18')) return { label: '深基金', color: '#b8860b', group: 'a' }
  if (code.startsWith('0')) return { label: '深A', color: '#3b8a68', group: 'a' }
  return { label: '—', color: 'gray', group: 'a' }
}

/** Debounced search input with market chips, quote summaries and keyboard add. */
export function SearchBox({ t, ops }: SearchBoxProps): ReactElement {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly EmSuggestion[]>([])
  const [state, setState] = useState<'idle' | 'searching' | 'empty' | 'failed'>('idle')
  const [message, setMessage] = useState('')
  const [group, setGroup] = useState<'all' | MarketGroup>('all')
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === '') {
      setResults([])
      setState('idle')
      setMessage('')
      setActive(-1)
      return
    }
    setState('searching')
    const timer = setTimeout(() => {
      void ops.search(trimmed).then((found) => {
        setResults(found)
        setState(found.length === 0 ? 'empty' : 'idle')
        setMessage('')
        setActive(-1)
      }).catch((error: unknown) => {
        setState('failed')
        setMessage(error instanceof Error ? error.message : String(error))
      })
    }, 300)
    return () => { clearTimeout(timer) }
  }, [query, ops])

  const visible = results.filter((entry) => {
    if (group === 'all') return true
    return marketOf(entry).group === group
  })

  const keyboard = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, visible.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, -1))
    } else if (event.key === 'Enter' && active >= 0 && active < visible.length) {
      event.preventDefault()
      void ops.add(visible[active]?.code ?? '')
    }
  }

  const chips: { key: 'all' | MarketGroup; label: string; count: number }[] = [
    { key: 'all', label: `全部结果`, count: results.length },
    { key: 'a', label: '沪深A股', count: results.filter((entry) => marketOf(entry).group === 'a').length },
    { key: 'hkus', label: '港股', count: results.filter((entry) => marketOf(entry).group === 'hkus').length },
    { key: 'us', label: '美股', count: results.filter((entry) => marketOf(entry).group === 'us').length },
  ]

  return (
    <div className="emqs-box">
      <style>{CSS}</style>
      <div className="emqs-row">
        <span className="emqs-icon">⌕</span>
        <input
          ref={inputRef}
          className="emqs-input"
          value={query}
          placeholder={t('searchPlaceholder')}
          onChange={(event) => { setQuery(event.target.value) }}
          onKeyDown={keyboard}
        />
        {query !== ''
          ? <button type="button" className="emqs-clear" onClick={() => { setQuery('') }}>✕</button>
          : null}
      </div>
      {results.length > 0
        ? (
            <div className="emqs-chips">
              {chips.map((chip) => (
                <button key={chip.key} type="button" className="emqs-chip" data-active={group === chip.key}
                  onClick={() => { setGroup(chip.key); setActive(-1) }}>
                  {`${chip.label} (${String(chip.count)})`}
                </button>
              ))}
            </div>
          )
        : null}
      {visible.map((entry, index) => {
        const market = marketOf(entry)
        const added = ops.symbols.includes(entry.code)
        return (
          <div key={entry.code} className="emqs-item" data-active={active === index}>
            <span className="emqs-mkt" style={{ background: market.color }}>{market.label}</span>
            <span className="emqs-main">
              <span className="emqs-title">
                {entry.name}
                <code>{entry.code}</code>
              </span>
              {entry.price !== undefined || entry.changePct !== undefined
                ? (
                    <span className="emqs-quote">
                      <span>{`${t('price')} ${entry.price === undefined ? '—' : String(entry.price)}`}</span>
                      <span style={{ color: entry.changePct === undefined ? undefined : entry.changePct > 0 ? 'var(--emq-up, #e03131)' : entry.changePct < 0 ? 'var(--emq-down, #2f9e44)' : undefined }}>
                        {entry.changePct === undefined ? '' : `${entry.changePct > 0 ? '+' : ''}${String(entry.changePct)}%`}
                      </span>
                    </span>
                  )
                : null}
            </span>
            <button type="button" className="emqs-add" disabled={added}
              onClick={() => { void ops.add(entry.code) }}>
              {added ? '✓' : `+ ${t('add')}`}
            </button>
          </div>
        )
      })}
      {state === 'searching' ? <span className="emqs-status">{t('searching')}</span> : null}
      {state === 'empty' ? <span className="emqs-status">{t('noResults')}</span> : null}
      {state === 'failed'
        ? <span className="emqs-fail">{`${t('searchFailed')}${message === '' ? '' : `: ${message}`}`}</span>
        : null}
    </div>
  )
}
