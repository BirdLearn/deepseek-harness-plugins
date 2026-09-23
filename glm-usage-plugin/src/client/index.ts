/** Client face: settings section registration fed by the Host quota route. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, zh, type UsageKey } from './locales.ts'
import { UsageSection, type UsageInjected, type UsageSnapshot } from './UsageSection.tsx'
import { ComposerUsageBadge } from './UsageCompact.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** GLM usage copy namespace. */
    'glm.usage': UsageKey
  }
}

/** Required service keys. */
export const inject = ['slots', 'locale']

/** Body answered by the Host `/glm-usage/summary` route. */
interface SummaryBody {
  configured: boolean
  snapshot?: { level: string; fetchedAt: number; limits: readonly { type: string; percentage: number; currentValue: number; usage: number; nextResetTime?: number }[] }
  failure?: string
}

/**
 * Register the GLM usage section into the settings page.
 * @param ctx - Browser context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('glm.usage', { en, zh }), 'glm.usage: dictionaries')
  const t = ctx.locale.bind('glm.usage')

  let snapshot: UsageSnapshot = { loading: true, unconfigured: false, failed: false }
  const listeners = new Set<() => void>()
  const publish = (value: UsageSnapshot): void => {
    snapshot = value
    for (const listener of listeners) listener()
  }

  const refresh = async (): Promise<void> => {
    try {
      const response = await fetch('/glm-usage/summary')
      const body = await response.json() as SummaryBody
      publish({
        loading: false,
        unconfigured: !body.configured,
        failed: body.configured && body.snapshot === undefined,
        failure: body.failure,
        level: body.snapshot?.level,
        windows: body.snapshot?.limits,
        fetchedAt: body.snapshot?.fetchedAt,
      })
    } catch {
      publish({ ...snapshot, loading: false, failed: true, failure: 'network request failed' })
    }
  }
  void refresh()
  const poll = setInterval(() => { void refresh() }, 5 * 60_000)
  ctx.effect(() => () => { clearInterval(poll) }, 'glm.usage: poll timer')

  const operations: UsageInjected = {
    refresh,
    hooks: {
      usage: {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      },
    },
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'glm-usage',
    order: 40,
    label: () => t('nav'),
    locale: 'glm.usage',
    inject: () => operations,
  }, UsageSection))

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    locale: 'glm.usage',
    id: 'glm-usage-badge',
    order: 10,
    inject: () => operations,
  }, ComposerUsageBadge))
}
