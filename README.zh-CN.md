# DeepSeek Harness 插件

[English](README.md) | [中文](README.zh-CN.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 社区插件仓库。Harness 是一个全插件化的 Cordis Agent 框架，配有 Web / 桌面客户端。本仓库托管**仓库外插件 bundle**：每个包都可以通过桌面应用的 **Plugins** 页面安装，为 Harness UI 增加新的面板。

## 插件

### [glm-usage-panel](glm-usage-plugin/)

GLM Coding Plan（智谱 z.ai / bigmodel 套餐）配额实时监控。

- **输入框环形图标** — 输入工具栏上的小环形用量指示；hover 弹出详情卡片：每个额度窗口（5 小时滚动窗口、每周额度）的进度条、剩余额度、重置时间与倒计时。
- **设置分节** — 完整配额面板，支持手动刷新。
- API Key 永不进入配置文件、日志或浏览器：插件每次请求都通过 Harness 凭据服务解析**凭据引用**。

| 配置 | 默认值 | 说明 |
|---|---|---|
| `baseUrl` | `https://open.bigmodel.cn` | 平台源；国际版用 `https://api.z.ai`。 |
| `apiKeyRef` | `ZAI_CODING_CN_API_KEY` | 凭据引用名 — 可改为任何持有你的 key 的引用名。 |
| `cacheTtlMs` | `60000` | 对平台真实调用的最小间隔（毫秒）。 |

数据源：`GET {baseUrl}/api/monitor/usage/quota/limit`。

### [eastmoney-quotes-panel](eastmoney-quotes-plugin/)

A 股 + 港股自选实时行情，数据来自东财 / 腾讯 / 新浪公开接口。

- **输入框 K 线图标** — hover 展示全部自选（单行紧凑：名称、交易所代码、现价、涨跌胶囊），按涨跌幅排序，每次 hover 主动刷新。
- **设置分节 — 实时盯盘矩阵** — 市场页签（全部 / A 股 / 港股·美股）、市场徽章（沪A / 深A / 科创 / 创业 / 北A / 港股）、千分位价格、涨跌胶囊、振幅、行 hover 快捷操作（上移 / 下移 / 删除），以及带市场范围筛选和键盘导航（↑↓ + Enter）的搜索卡片。
- **自选持久化** — 增删与排序持久化到 `$DSH_HOME/storages/eastmoney-quotes-panel/`。
- **多源自动降级** — 行情：东财 → 腾讯 → 新浪；搜索：腾讯 smartbox（名称 / 拼音 / 代码）→ 东财 suggest。全部为公开免密接口。

| 配置 | 默认值 | 说明 |
|---|---|---|
| `symbols` | `600519,000001,300750` | 初始自选；运行时的修改持久化在存储中并优先生效。 |
| `source` | `auto` | `auto` 按链降级，或固定 `eastmoney` / `tencent` / `sina`。 |

## 安装（桌面应用）

1. 先构建插件（见下文）。
2. 在 DeepSeek Harness 桌面应用中打开 **设置 → 插件**，从本地路径安装：
   - `glm-usage-plugin/`
   - `eastmoney-quotes-plugin/`

每个目录都声明了 `dsh.bundle`，安装即挂载；安装后重启一次应用让 Host 半边生效。

## 构建

插件借用 DeepSeek Harness 源码仓库的依赖（内部 `@deepseek-ai/*` 包的 npm 发布版本落后于工作区）。

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git   # 放在同一父目录
cd deepseek-harness && pnpm install && pnpm run build           # Node 22.19+，pnpm 11

cd ../deepseek-harness-plugins
./setup-links.sh            # 把 @deepseek-ai/* 与构建工具链链接进各插件

cd eastmoney-quotes-plugin  # 或 glm-usage-plugin
node node_modules/tsdown/dist/run.mjs          # 产出 lib/index.js + lib/client.js
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json   # 类型检查
```

修改代码后重新构建并重启桌面应用 — 客户端 bundle 的 rev 由文件 mtime 推导，刷新页面即可加载新的 `lib/client.js`。

## 文档

- [开发经验笔记（中文）](docs/development-notes.zh-CN.md) — 仓库外 Harness 插件开发的完整经验：双半边包、lazy-CJS 客户端 bundle 格式、槽位注册、凭据引用、数据源特性与 macOS 构建坑。
- 各插件详细说明：[glm-usage-panel](glm-usage-plugin/README.md) · [eastmoney-quotes-panel](eastmoney-quotes-plugin/README.md)

## 许可证

[MIT](LICENSE)
