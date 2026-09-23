/** Composer btw trigger with a click-open reminder input — mirroring the
 * ContextMeter interaction (click toggle, portal panel, outside pointer /
 * Escape dismiss). Disabled while the session has no running task. */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { StateDot, useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { BtwKey } from './locales.ts'

/** Body answered by the Host `/btw/send` route. */
export interface BtwSendResult {
  injected: boolean
  reason?: 'not-found' | 'idle' | 'too-long'
  maxChars?: number
}

/** Composed trigger props: locale copy, session identity, and live run state. */
export interface BtwComposerProps {
  /** Localized copy. */
  t: (key: BtwKey) => string
  /** Current Session identity. */
  sessionId: string
  /** Live session state selector; only `running` is consumed. */
  useSession: <S>(selector: (snapshot: { running: boolean }) => S) => S
}

const CSS = `
.btwp-root { display: inline-flex; flex: none; }
.btwp-trigger { display: inline-flex; align-items: center; gap: 6px; flex: none; padding: 1px 8px;
  border: none; border-radius: 24px; background: transparent; color: var(--dsw-alias-label-tertiary);
  font-family: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
.btwp-trigger:hover, .btwp-trigger[aria-expanded='true'] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.btwp-trigger:disabled { opacity: 0.45; cursor: default; }
.btwp-trigger:disabled:hover { background: transparent; color: var(--dsw-alias-label-tertiary); }
.btwp-panel { position: fixed; z-index: 1100; box-sizing: border-box; width: min(320px, calc(100vw - 24px));
  padding: 12px; border: 0; border-radius: 12px; background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  box-shadow: var(--dsw-elevation-prominent); font-size: 12px; line-height: 20px;
  color: var(--dsw-alias-label-secondary); cursor: default; }
.btwp-head { display: flex; align-items: center; gap: 6px; }
.btwp-title { font-weight: 600; color: var(--dsw-alias-label-primary); }
.btwp-hint { margin-top: 6px; font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.btwp-row { display: flex; gap: 6px; margin-top: 8px; }
.btwp-input { flex: 1; min-width: 0; box-sizing: border-box; padding: 5px 8px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 12px; line-height: 18px; }
.btwp-input:focus { outline: none; border-color: var(--dsw-alias-border-l3); }
.btwp-input:disabled { opacity: 0.5; }
.btwp-send { flex: none; border: none; border-radius: 8px; padding: 5px 12px; cursor: pointer;
  background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 12px; font-weight: 600; }
.btwp-send:hover:enabled { background: var(--dsw-alias-interactive-bg-active); }
.btwp-send:disabled { opacity: 0.5; cursor: default; }
.btwp-foot { display: flex; align-items: center; gap: 5px; margin-top: 8px; padding-top: 6px;
  border-top: 1px solid var(--dsw-alias-border-l2); font-size: 10px; color: var(--dsw-alias-label-tertiary); }
`

/** Click-open composer trigger: btw bubble plus the anchored reminder input. */
export function BtwComposer({ t, sessionId, useSession }: BtwComposerProps): ReactElement {
  const running = useSession((snapshot) => snapshot.running)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [receipt, setReceipt] = useState<{ ok: boolean; label: string } | undefined>()
  const [sending, setSending] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
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

  useEffect(() => {
    // A finished task invalidates any optimistic receipt.
    if (!running) setReceipt(undefined)
  }, [running])

  const submit = async (): Promise<void> => {
    const body = text.trim()
    if (body === '' || sending || !running) return
    setSending(true)
    try {
      const response = await fetch('/btw/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, text: body }),
      })
      const result = await response.json() as BtwSendResult
      if (result.injected) {
        setReceipt({ ok: true, label: t('sent') })
        setText('')
      } else {
        const label = result.reason === 'idle' ? t('idle') : result.reason === 'too-long' ? t('tooLong') : t('failed')
        setReceipt({ ok: false, label })
      }
    } catch {
      setReceipt({ ok: false, label: t('failed') })
    } finally {
      setSending(false)
    }
  }

  return (
    <span ref={rootRef} className="btwp-root">
      <style>{CSS}</style>
      <button
        type="button"
        className="btwp-trigger"
        aria-label={t('title')}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!running && !open}
        title={running ? t('title') : t('idle')}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) setReceipt(undefined)
        }}
      >
        <svg width={13} height={13} viewBox="0 0 14 14" aria-hidden>
          <path d="M7 1.5 C3.7 1.5 1.2 3.7 1.2 6.4 C1.2 8 2.1 9.4 3.5 10.3 L3 12.5 L5.6 11.2 C6.05 11.3 6.5 11.35 7 11.35 C10.3 11.35 12.8 9.1 12.8 6.4 C12.8 3.7 10.3 1.5 7 1.5 Z"
            fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
        </svg>
        <span>btw</span>
      </button>
      {open && createPortal(
        <div ref={panelRef} className="btwp-panel" style={position ?? { visibility: 'hidden', left: 0, top: 0 }}
          role="dialog" aria-label={t('title')}>
          <div className="btwp-head">
            <StateDot state={running ? 'done' : 'idle'} size={8} />
            <span className="btwp-title">{t('title')}</span>
          </div>
          <div className="btwp-row">
            <input
              ref={inputRef}
              className="btwp-input"
              value={text}
              placeholder={t('placeholder')}
              disabled={!running || sending}
              autoFocus
              onChange={(e) => { setText(e.target.value) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) { void submit() }
              }}
            />
            <button type="button" className="btwp-send" disabled={!running || sending || text.trim() === ''} onClick={() => { void submit() }}>
              {t('send')}
            </button>
          </div>
          <div className="btwp-foot">
            <StateDot state={receipt === undefined ? (running ? 'done' : 'error') : receipt.ok ? 'done' : 'error'} size={6} />
            {receipt?.label ?? (running ? `${String(sessionId).slice(0, 18)}…` : t('idle'))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
