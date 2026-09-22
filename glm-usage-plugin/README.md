# glm-usage-panel

DeepSeek Harness 插件：在客户端中以进度条展示 GLM Coding Plan（智谱 z.ai / bigmodel 套餐）的用量、剩余额度与重置时间。

## 展示位置

| 位置 | 内容 |
|---|---|
| 输入框工具行左侧 | 16px 环形进度（环心显示百分比数字），hover 弹出详情卡片，点击刷新 |
| 设置 → GLM Usage 分节 | 完整面板：每个额度窗口的进度条、已用/剩余/总额、重置时间、手动刷新 |

详情卡片列出全部额度窗口（5 小时窗口 / 周额度）的百分比、剩余/总额与重置时间。超过 70% 变警示色（amber），超过 90% 变红色。数据 5 分钟自动刷新，缓存 TTL 默认 60s（可配）。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `baseUrl` | `https://open.bigmodel.cn` | 套餐平台；国际版用 `https://api.z.ai` |
| `apiKeyRef` | `ZAI_CODING_CN_API_KEY` | 凭据引用（凭据库中的 key 名），不是明文 key |
| `cacheTtlMs` | `60000` | 对平台接口的最小调用间隔（毫秒），≥30000 |

数据来源：`GET {baseUrl}/api/monitor/usage/quota/limit`，鉴权头为裸 API key。插件每次请求前经 `ctx.credentials.resolve(apiKeyRef)` 现取凭据，key 永不进入配置文件、日志或浏览器。

## 安装到 Desktop

在 DeepSeek Harness 桌面应用的 **Plugins** 页面从本地路径安装本目录（包含 `dsh.bundle` 声明，安装后自动挂载）。凭据需已存在：本机 Harness 凭据库（`~/.dsh/.credentials.yaml`）中已有 `ZAI_CODING_CN_API_KEY`。

## 本地构建

```sh
# 前置：在 deepseek-harness-plugins 根运行 ./setup-links.sh 建立依赖符号链接
cd glm-usage-plugin
node node_modules/tsdown/dist/run.mjs        # 产出 lib/index.js + lib/client.js
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

`lib/client.js` 是 lazy-CJS 工厂格式（`window.__ModuleLoader__.load(...)`），由 Host 的 client module system 按包名挂载；修改后重启 Host（或 HMR 环境下刷新页面）即生效。

## Web 端调试（可选）

```sh
export DSH_HOME=$PWD/.dev-home   # 或使用默认 home
pnpm dsh plugin --profile web add ./glm-usage-plugin
pnpm dsh web
# 验证：GET /glm-usage/summary 返回实时配额 JSON
```
