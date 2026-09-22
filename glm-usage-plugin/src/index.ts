/** Host face: authenticated quota route backed by the configured credential reference. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { fetchGlmQuota, type GlmQuotaResult, type GlmQuotaSnapshot } from './glm-api.ts'
import { type Config } from './config.ts'

export { Config } from './config.ts'

/** JSON body answered by the `/glm-usage/summary` route. */
export interface GlmUsageSummary {
  /** Whether a credential value resolved; false renders the setup hint. */
  configured: boolean
  /** Latest snapshot when configured and a fetch succeeded at least once. */
  snapshot?: GlmQuotaSnapshot
  /** Latest failure reason when the most recent fetch failed. */
  failure?: string
}

/** Required service keys. */
export const inject = ['credentials', 'webServer']

/**
 * Register the quota summary route. The API key resolves per request and never
 * enters the response, logs, or plain configuration.
 * @param ctx - Host context.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  let cache: { readonly at: number; readonly result: GlmQuotaResult } | undefined

  const summary = async (): Promise<GlmUsageSummary> => {
    const resolved = await ctx.credentials.resolve(config.apiKeyRef as never)
    if (resolved === undefined || resolved.value === '') return { configured: false }
    if (cache === undefined || Date.now() - cache.at >= config.cacheTtlMs) {
      const result = await fetchGlmQuota(config.baseUrl, resolved.value)
      cache = { at: Date.now(), result }
    }
    const result = cache.result
    if (!result.ok) return { configured: true, failure: result.error.message }
    return { configured: true, snapshot: result.value }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/glm-usage/summary',
    handler: async (_request: IncomingMessage, response: ServerResponse) => {
      const body = await summary()
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(body))
    },
  }), 'glm-usage: summary route')
}
