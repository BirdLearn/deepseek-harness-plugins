# eastmoney-quotes-panel

DeepSeek Harness 插件：在设置页展示**自选股票 A 股实时行情**表格（价格、涨跌幅、高低开收、量额），多数据源自动降级。

## 展示位置

设置 → **自选行情** 分节：实时行情表格，A股配色（红涨绿跌），10 秒自动刷新 + 手动刷新按钮。

## 配置（插件设置页可改，热更新）

| 字段 | 默认 | 说明 |
|---|---|---|
| `symbols` | `600519,000001,300750` | 自选代码串；支持A股（6位代码或 `sh`/`sz`/`bj` 前缀）与港股（`hk00700`）。搜索添加时自动带前缀 |
| `source` | `auto` | `auto`＝按链降级；或固定 `api` / `eastmoney` / `tencent` / `sina` |
| `apiBaseUrl` | （空） | 自建行情服务地址，如 `http://1.14.153.177:8989`；留空禁用 |
| `apiKey` | （空） | 请求自建行情服务时携带的 `X-API-Key` |

### 自建行情服务（API 源）

**推荐：直接在「自选行情」面板底部展开「数据源」卡片填写**「自建行情服务地址」与「X-API-Key」，保存即生效（持久化到 `~/.dsh/storages/eastmoney-quotes-panel/settings.json`，Key 只显示掩码）。也可以通过插件配置字段 `apiBaseUrl`/`apiKey` 设置（面板中保存的值优先）。

两个字段就绪后，`source: auto` 会**优先**请求自建服务 `GET {apiBaseUrl}/api/v1/stocks/quotes?codes=600519,000001`（请求头 `X-API-Key`），失败时自动降级到东财/腾讯/新浪；也可以把 `source` 固定为 `api` 强制只用该服务。该源响应中的 `changePct` 是小数（如 `-0.002`），插件会换算为百分比展示。

### 数据源与降级链

| 顺序 | 源 | 接口 |
|---|---|---|
| 0 | api（可选，需配置） | 自建服务 `/api/v1/stocks/quotes`，带 `X-API-Key` |
| 1 | eastmoney | `push2.eastmoney.com/api/qt/ulist.np/get`（批量，字段最全） |
| 2 | tencent | `qt.gtimg.cn/q=`（GBK，自动派生涨跌幅） |
| 3 | sina | `hq.sinajs.cn/list=`（GBK，需 Referer，自动派生涨跌幅） |

东财的边缘节点会拒绝裸程序化客户端并对高频 IP 限流，因此请求默认带浏览器 UA/Referer，`auto` 模式下任一源失败自动尝试下一个；本机调试时东财被限流，实测已自动落 Tencent 且三只标的数据与东财原始响应一致。10 秒轮询 × 少量自选的频率对公开接口是安全的；如遇限流提示，把 `source` 固定为 `tencent` 即可。

## 安装到 Desktop

桌面应用 **Plugins** 页面从本地路径安装本目录（含 `dsh.bundle`，安装即挂载）。

## 本地构建

```sh
# 前置：在 deepseek-harness-plugins 根运行 ./setup-links.sh 建立依赖符号链接
cd eastmoney-quotes-plugin
node node_modules/tsdown/dist/run.mjs        # 产出 lib/index.js + lib/client.js
# 若 tsdown 因缺少 unrun 依赖无法加载配置，可用备选脚本（直接调 rolldown，产物等价）：
node scripts/build-rolldown.mjs
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

## 数据层单测（可选）

```sh
node --import node_modules/tsx/dist/loader.mjs --input-type=module -e "
import { fetchQuotes } from './src/em-api.ts'
console.log(await fetchQuotes(['600519','000001'], 'auto'))"
```
