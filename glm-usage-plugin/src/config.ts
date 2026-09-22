/** Plugin configuration: platform origin, credential reference, and cache lifetime. */
import z from '@deepseek-ai/schemastery'

/** Validated plugin configuration received by {@link apply}. */
export interface Config {
  /** Platform origin serving the quota endpoint; `open.bigmodel.cn` domestically, `api.z.ai` internationally. */
  baseUrl: string
  /** Credential reference (environment-variable name) holding the GLM platform API key. */
  apiKeyRef: string
  /** Minimum milliseconds between real quota endpoint calls; answers in between come from cache. */
  cacheTtlMs: number
}

export const Config = z.object({
  baseUrl: z.string().default('https://open.bigmodel.cn'),
  apiKeyRef: z.string().role('credential-ref').default('ZAI_CODING_CN_API_KEY'),
  cacheTtlMs: z.number().step(1000).min(30_000).default(300_000),
})
