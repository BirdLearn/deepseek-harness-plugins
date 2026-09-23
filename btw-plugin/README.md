# btw-panel

Mid-task **btw reminders** for DeepSeek Harness sessions. While a task is running, drop a side note ("by the way…") into the conversation **without interrupting the running work**: the reminder is silently injected into the agent's `next-step` inbox and the model reads it at the nearest tool-call step boundary.

## How it works

- **Composer bubble icon** — a small `btw` trigger in the input toolbar (slot order 30, after glm-usage 10 and quotes 20). Click to open a reminder input; the trigger and input are enabled only while the current session has a running task (live `running` state from the session standard props, no polling).
- **Silent injection** — the client posts `{ sessionId, text }` to the Host `/btw/send` route. The Host resolves the live agent via the `agents` registry and calls `agent.inject(createUserMessage(...))`: the message joins the `next-step` inbox **without waking or aborting** the running turn, so the flow continues untouched and the model sees the reminder as side-channel context at the next step boundary.
- **Source tagging** — each reminder is stamped with a `btw-reminder` message source and the configured prefix (default `[btw]`), so the model — and the transcript — can tell side notes from user turns.

| Config | Default | Description |
|---|---|---|
| `prefix` | `[btw]` | Prefix prepended to every injected reminder. |
| `maxChars` | `2000` | Maximum accepted reminder length in characters. |

### Routes

- `POST /btw/send` — `{ sessionId, text }` → `{ injected, reason?, maxChars? }`; `reason` is `not-found` (no live agent or empty body), `idle` (agent not in a turn), or `too-long`.
- `GET /btw/status?sessionId=…` — `{ exists, running }`.

## Install (Desktop)

1. Build the plugin (see the repository README).
2. In the DeepSeek Harness Desktop app, open **Settings → Plugins** and install from a local path: `btw-plugin/`.

## Build

```sh
./setup-links.sh            # links @deepseek-ai/* + toolchain into each plugin, incl. btw-plugin
cd btw-plugin
node node_modules/typescript/lib/tsc.js -p tsconfig.json   # type check
node node_modules/tsdown/dist/run.mjs                      # emits lib/index.js + lib/client.js
node smoke-test.mjs                                        # route behavior smoke test
```
