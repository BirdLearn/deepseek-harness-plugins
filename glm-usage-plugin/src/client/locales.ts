/** GLM usage settings copy, owned by the glm-usage-panel plugin. */
export const en = {
  nav: 'GLM Usage',
  title: 'GLM Coding Plan',
  loading: 'Loading usage…',
  notConfigured: 'Set a GLM API key credential to see your plan usage.',
  fetchFailed: 'Could not load usage',
  refresh: 'Refresh',
  refreshedAt: 'Updated',
  totalWindow: '5-hour window',
  weeklyWindow: 'Weekly allowance',
  otherWindow: 'Allowance',
  remaining: 'Left',
  tight: 'Tight',
  resetAt: 'Resets',
} as const
/** GLM usage locale keys. */
export type UsageKey = keyof typeof en
/** Chinese GLM usage copy. */
export const zh: Record<UsageKey, string> = {
  nav: 'GLM 用量',
  title: 'GLM Coding Plan',
  loading: '正在加载用量…',
  notConfigured: '配置 GLM API Key 凭据引用后即可查看套餐用量。',
  fetchFailed: '用量加载失败',
  refresh: '刷新',
  refreshedAt: '更新于',
  totalWindow: '5 小时窗口',
  weeklyWindow: '每周额度',
  otherWindow: '额度',
  remaining: '剩余',
  tight: '额度偏紧',
  resetAt: '重置时间',
}
