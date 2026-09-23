/** Smoke test: exercise the /btw routes with a fake harness context. */
import assert from 'node:assert/strict'
import { apply, Config } from './lib/index.js'

const parseConfig = Config({ prefix: '[btw]', maxChars: 2000 })

/** Fake agent status/members the routes consult. */
const agents = new Map()

let captured = undefined
const ctx = {
  agents: { get: (id) => agents.get(String(id)) },
  logger: { warn: () => {} },
  effect(fn) { fn() },
  webServer: {
    routes: new Map(),
    register(def) { this.routes.set(def.path, def.handler) },
  },
}

apply(ctx, parseConfig)

const callSend = async (body) => {
  const chunks = []
  const response = { headers: [], writeHead(code, h) { this.code = code }, end(data) { chunks.push(data) } }
  const request = { url: '/btw/send', [Symbol.asyncIterator]() {
    let done = false
    return { next: () => Promise.resolve(done ? { done: true } : { value: Buffer.from(JSON.stringify(body)), done: false, then: () => (done = true) }) }
  } }
  // simpler: async iterator over one chunk
  const oneChunk = { [Symbol.asyncIterator]: () => ({ next: async () => (done ? { done: true } : (done = true, { value: Buffer.from(JSON.stringify(body)) })) }) }
  let done = false
  request[Symbol.asyncIterator] = () => ({ next: async () => (done ? { done: true } : (done = true, { value: Buffer.from(JSON.stringify(body)) })) })
  await ctx.webServer.routes.get('/btw/send')(request, response)
  return JSON.parse(chunks.join(''))
}

const callStatus = async (sessionId) => {
  const chunks = []
  const response = { writeHead() {}, end(data) { chunks.push(data) } }
  await ctx.webServer.routes.get('/btw/status')({ url: `/btw/status?sessionId=${encodeURIComponent(sessionId)}` }, response)
  return JSON.parse(chunks.join(''))
}

// 1. unknown session → not-found
assert.deepEqual(await callSend({ sessionId: 'session-1', text: 'hello' }), { injected: false, reason: 'not-found', maxChars: 2000 })

// 2. idle agent → idle
agents.set('session-1', { status: 'idle', inject: (m) => { captured = m } })
assert.deepEqual(await callSend({ sessionId: 'session-1', text: 'hello' }), { injected: false, reason: 'idle' })

// 3. running agent → injected with prefix and btw source
agents.set('session-1', { status: 'running', inject: (m) => { captured = m } })
assert.deepEqual(await callSend({ sessionId: 'session-1', text: '  hello btw  ' }), { injected: true })
assert.equal(captured.role, 'user')
assert.equal(captured.source.kind, 'btw-reminder')
assert.equal(captured.content[0].text, '[btw] hello btw')

// 4. too long → too-long with echoed limit
assert.deepEqual(await callSend({ sessionId: 'session-1', text: 'x'.repeat(2001) }), { injected: false, reason: 'too-long', maxChars: 2000 })

// 5. empty text → not-found guard
assert.deepEqual(await callSend({ sessionId: 'session-1', text: '   ' }), { injected: false, reason: 'not-found', maxChars: 2000 })

// 6. status route
assert.deepEqual(await callStatus('session-1'), { exists: true, running: true })
assert.deepEqual(await callStatus('session-none'), { exists: false, running: false })

console.log('all btw route smoke checks passed')
