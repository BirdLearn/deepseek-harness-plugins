/** Plugin configuration: injected reminder prefix and length limit. */
import z from '@deepseek-ai/schemastery'

/** Validated plugin configuration received by {@link apply}. */
export interface Config {
  /** Prefix prepended to every injected reminder so the model recognizes side-channel context. */
  prefix: string
  /** Maximum accepted reminder length in characters; longer bodies are rejected. */
  maxChars: number
}

export const Config = z.object({
  prefix: z.string().default('[btw]'),
  maxChars: z.number().step(100).min(100).max(10_000).default(2_000),
})
