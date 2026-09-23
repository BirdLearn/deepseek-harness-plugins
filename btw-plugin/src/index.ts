/** Host face: silent btw reminder injection into a running agent's next-step inbox. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { type Config } from './config.ts'

export { Config } from './config.ts'

/** Side-channel producer tag for btw reminders; consumers fall through unknown kinds. */
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'btw-reminder': { kind: 'btw-reminder' }
  }
}

/** Body answered by the `/btw/send` route. */
export interface BtwSendResult {
  /** Whether the reminder entered the agent's next-step inbox. */
  injected: boolean
  /** Why injection was refused: no live agent, agent not running, or body too long. */
  reason?: 'not-found' | 'idle' | 'too-long'
  /** Configured length limit, echoed for client-side validation. */
  maxChars?: number
}

/** Body answered by the `/btw/status` route. */
export interface BtwStatus {
  /** Whether a live agent exists for the session. */
  exists: boolean
  /** Whether that agent is inside a turn; btw requires this. */
  running: boolean
}

/** Largest accepted request body in bytes; reminders are text and tiny. */
const MAX_BODY_BYTES = 16 * 1024

/** Required service keys. */
export const inject = ['agents', 'webServer']

/**
 * Register the btw send and status routes. A reminder is injected with
 * `agent.inject()` — it joins the next-step inbox without waking or
 * interrupting the running turn, so the model reads it at the nearest
 * step boundary as side-channel context.
 * @param ctx - Host context.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const send = (response: ServerResponse, body: unknown): void => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }

  const readJson = async (request: IncomingMessage): Promise<unknown> => {
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of request) {
      total += (chunk as Buffer).length
      if (total > MAX_BODY_BYTES) throw new Error('body too large')
      chunks.push(chunk as Buffer)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/btw/send',
    handler: async (request: IncomingMessage, response: ServerResponse) => {
      let body: BtwSendResult
      try {
        const parsed = await readJson(request) as { sessionId?: unknown; text?: unknown }
        const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : ''
        const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
        if (sessionId === '' || text === '') {
          body = { injected: false, reason: 'not-found', maxChars: config.maxChars }
        } else if (text.length > config.maxChars) {
          body = { injected: false, reason: 'too-long', maxChars: config.maxChars }
        } else {
          const agent = ctx.agents.get(SessionId(sessionId))
          if (agent === undefined) {
            body = { injected: false, reason: 'not-found', maxChars: config.maxChars }
          } else if (agent.status !== 'running') {
            body = { injected: false, reason: 'idle' }
          } else {
            agent.inject(createUserMessage({
              content: [{ type: 'text', text: `${config.prefix} ${text}` }],
              source: { kind: 'btw-reminder' },
            }))
            body = { injected: true }
          }
        }
      } catch (error) {
        body = { injected: false, reason: 'not-found' }
        ctx.logger.warn('btw send failed: %s', error instanceof Error ? error.message : String(error))
      }
      send(response, body)
    },
  }), 'btw: send route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/btw/status',
    handler: async (request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const sessionId = url.searchParams.get('sessionId') ?? ''
      const agent = sessionId === '' ? undefined : ctx.agents.get(SessionId(sessionId))
      send(response, { exists: agent !== undefined, running: agent?.status === 'running' } satisfies BtwStatus)
    },
  }), 'btw: status route')
}
