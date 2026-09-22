# DeepSeek Harness Plugins

[English](README.md) | [中文](README.zh-CN.md)

Community plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — an all-plugin Cordis agent harness with a Web/Desktop client. This repository hosts out-of-tree plugin **bundles**: each package installs through the Desktop **Plugins** page and adds new panels to the Harness UI.

## Plugins

### [glm-usage-panel](glm-usage-plugin/)

Live GLM Coding Plan quota monitoring for your z.ai / bigmodel subscription.

- **Composer ring icon** — a small usage ring in the input toolbar; hovering opens a detail card with per-window progress bars (5-hour rolling window and weekly allowance), remaining credits, reset times and countdowns.
- **Settings section** — the full quota panel with manual refresh.
- The API key never appears in config files, logs, or the browser: the plugin resolves a **credential reference** through the Harness credential service on every request.

| Config | Default | Description |
|---|---|---|
| `baseUrl` | `https://open.bigmodel.cn` | Platform origin; use `https://api.z.ai` for the international endpoint. |
| `apiKeyRef` | `ZAI_CODING_CN_API_KEY` | Credential reference name — change it to whichever reference holds your key. |
| `cacheTtlMs` | `60000` | Minimum interval between real platform calls. |

Data source: `GET {baseUrl}/api/monitor/usage/quota/limit`.

### [eastmoney-quotes-panel](eastmoney-quotes-plugin/)

Realtime A-share and HK watchlist quotes, powered by public Eastmoney / Tencent / Sina endpoints.

- **Composer candlestick icon** — hover to list every watched symbol on one compact line (name, exchange code, last price, change pill), sorted by change percentage, refreshed on every hover.
- **Settings section — live matrix** — market tabs (All / A-shares / HK·US), market badges (沪A / 深A / 科创 / 创业 / 北A / 港股), thousand-separated prices, change pills, amplitude, hover quick actions (move up/down, remove), and a search card with market-scope chips and keyboard navigation (↑↓ + Enter).
- **Watchlist persistence** — additions, removals and reordering persist under `$DSH_HOME/storages/eastmoney-quotes-panel/`.
- **Multi-source fallback** — quotes: Eastmoney → Tencent → Sina; search: Tencent smartbox (name / pinyin / code) → Eastmoney suggest. All sources are public and keyless.

| Config | Default | Description |
|---|---|---|
| `symbols` | `600519,000001,300750` | Initial watchlist; runtime edits persist in storage and take precedence. |
| `source` | `auto` | `auto` walks the fallback chain, or pin one of `eastmoney` / `tencent` / `sina`. |

## Install (Desktop)

1. Build the plugins (see below).
2. In the DeepSeek Harness Desktop app, open **Settings → Plugins** and install from a local path:
   - `glm-usage-plugin/`
   - `eastmoney-quotes-plugin/`

Each directory declares `dsh.bundle`, so installing mounts it immediately; restart the app once so the Host half activates.

## Build

The plugins borrow dependencies from a DeepSeek Harness source checkout (published npm versions of the internal `@deepseek-ai/*` packages lag the workspace).

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git   # same parent directory
cd deepseek-harness && pnpm install && pnpm run build           # Node 22.19+, pnpm 11

cd ../deepseek-harness-plugins
./setup-links.sh            # link @deepseek-ai/* + toolchain into each plugin

cd eastmoney-quotes-plugin  # or glm-usage-plugin
node node_modules/tsdown/dist/run.mjs          # emits lib/index.js + lib/client.js
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json   # typecheck
```

After editing, rebuild and restart the Desktop app — the client bundle revision is derived from file mtimes, so a reload picks up `lib/client.js` automatically.

## Documentation

- [Development notes (中文)](docs/development-notes.zh-CN.md) — everything learned building out-of-tree Harness plugins: dual-face packages, the lazy-CJS client bundle format, slot registration, credential references, provider quirks and macOS build pitfalls.
- Per-plugin READMEs: [glm-usage-panel](glm-usage-plugin/README.md) · [eastmoney-quotes-panel](eastmoney-quotes-plugin/README.md)

## License

[MIT](LICENSE)
