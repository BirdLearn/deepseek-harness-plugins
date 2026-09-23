/** Client face: composer btw entry fed by the Host send route and live session state. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { en, zh, type BtwKey } from './locales.ts'
import { BtwComposer } from './BtwComposer.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** btw copy namespace. */
    'btw.ui': BtwKey
  }
}

/** Required service keys. */
export const inject = ['slots', 'locale']

/**
 * Register the btw trigger into the composer dock.
 * @param ctx - Browser context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('btw.ui', { en, zh }), 'btw.ui: dictionaries')
  const t = ctx.locale.bind('btw.ui')

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    locale: 'btw.ui',
    id: 'btw-composer',
    order: 30,
  }, BtwComposer))
}
