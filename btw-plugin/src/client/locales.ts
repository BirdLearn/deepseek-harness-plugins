/** btw composer copy, owned by the btw-panel plugin. */
export const en = {
  title: 'btw reminder',
  placeholder: 'Side note for the running task…',
  send: 'Send',
  idle: 'No running task — reminders only work mid-task.',
  sent: 'Injected ✓ takes effect at the next step',
  failed: 'Failed to send',
  tooLong: 'Too long',
} as const
/** btw locale keys. */
export type BtwKey = keyof typeof en
/** Chinese btw copy. */
export const zh: Record<BtwKey, string> = {
  title: 'btw 顺带提醒',
  placeholder: '给正在运行的任务带句话…',
  send: '发送',
  idle: '当前无运行中任务，btw 仅在任务进行中可用。',
  sent: '已注入 ✓ 下一步生效',
  failed: '发送失败',
  tooLong: '内容过长',
}
