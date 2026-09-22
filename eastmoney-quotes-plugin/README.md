# eastmoney-quotes-panel

DeepSeek Harness 插件：在设置页展示**自选股票 A 股实时行情**表格（价格、涨跌幅、高低开收、量额），多数据源自动降级。

## 展示位置

设置 → **自选行情** 分节：实时行情表格，A股配色（红涨绿跌），10 秒自动刷新 + 手动刷新按钮。

## 配置（插件设置页可改，热更新）

| 字段 | 默认 | 说明 |
|---|---|---|
| `symbols` | `600519,000001,300750` | 自选代码串；支持A股（6位代码或 `sh`/`sz`/`bj` 前缀）与港股（`hk00700`）。搜索添加时自动带前缀 |
| `source` | `auto` | `auto`＝按链降级；或固定 `eastmoney` / `tencent` / `sina` |

### 数据源与降级链

| 顺序 | 源 | 接口 |
|---|---|---|
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
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

## 数据层单测（可选）

```sh
node --import node_modules/tsx/dist/loader.mjs --input-type=module -e "
import { fetchQuotes } from './src/em-api.ts'
console.log(await fetchQuotes(['600519','000001'], 'auto'))"
```
