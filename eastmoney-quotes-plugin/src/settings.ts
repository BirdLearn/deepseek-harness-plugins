/** Plugin-owned durable data-source settings under the Harness home. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

const STORAGE_FILE = ['storages', 'eastmoney-quotes-panel', 'settings.json']

/** Stored data-source settings document. */
export interface ApiSettingsDoc {
  /** Base URL of the self-hosted quotes service; empty/absent disables it. */
  apiBaseUrl?: string
  /** `X-API-Key` sent to the service. */
  apiKey?: string
}

/** Read the stored settings; absent or corrupt storage yields `undefined`. */
export function loadApiSettings(): ApiSettingsDoc | undefined {
  const file = dshHomePath(...STORAGE_FILE)
  if (!existsSync(file)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ApiSettingsDoc>
    return {
      apiBaseUrl: typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : undefined,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : undefined,
    }
  } catch {
    return undefined
  }
}

/** Persist the settings durably. */
export function saveApiSettings(doc: ApiSettingsDoc): void {
  writeFileSync(dshHomePath(...STORAGE_FILE), JSON.stringify(doc, null, 2))
}

/**
 * Effective settings: each stored field wins over the configured default.
 * @param configured - values from the plugin config as fallback.
 */
export function currentApiSettings(configured: ApiSettingsDoc): Required<ApiSettingsDoc> {
  const stored = loadApiSettings()
  return {
    apiBaseUrl: (stored?.apiBaseUrl ?? configured.apiBaseUrl ?? '').trim(),
    apiKey: (stored?.apiKey ?? configured.apiKey ?? '').trim(),
  }
}
