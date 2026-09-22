# DeepSeek Harness 外部插件开发经验总结

> 来源：`glm-usage-plugin`（GLM Coding Plan 用量面板）与 `eastmoney-quotes-panel`（自选股实时行情）两个完整插件的实战开发。仓库外插件（out-of-repo bundle）的完整路径，适用于 DeepSeek Harness 桌面/Web 客户端。

## 目录结构约定（两个插件均如此）

```
<plugin>/
├─ package.json          # dsh.bundle + dsh.client 双声明
├─ tsdown.config.ts      # 双面构建：node ESM + 浏览器 lazy-CJS 工厂
├─ cordis.patch.yml      # bundle 安装时挂载的配置层
├─ tsconfig.json
├─ setup 链接依赖        # 由仓库根 setup-links.sh 统一重建
└─ src/
   ├─ index.ts           # Host 半边：webserver 路由 / 服务
   ├─ config.ts          # schemastery Config schema（导出名必须是 Config）
   ├─ <api>.ts           # 数据源客户端（可独立单测）
   └─ client/
      ├─ index.ts        # 浏览器半边 apply：locale.register + slots.inject
      ├─ <Section>.tsx   # React 组件（不收 ctx，一切经 props shares）
      └─ locales.ts      # en/zh 字典（zh 必须覆盖 en 全部 key）
```

## 核心机制（必读）

### 1. 插件 = 双半边包
- **Host 半边** `lib/index.js`：Loader 以 ESM 导入；没有它浏览器半边不会被扫描。
- **Client 半边** `exports["./client"]` → `lib/client.js`：**文件名硬约束**，格式是 lazy-CJS 工厂：

```js
window.__ModuleLoader__.load({ id: "<包名>", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
/* 打包代码，基线依赖编译成 require("...") */
return module.exports; } });
```

由 Host 的 client module system 经 `/plugins/??<pkg>/client.js&rev=<rev>` 下发（URL 里的 `??` 是字面量！），`rev` 由文件 mtime/ctime/size 推导，**重建 lib/client.js 后重启 Host 或刷新页面即生效**。未带 rev 的直接请求 404 是设计行为（"未通告组合"）。

### 2. manifest 关键字段

```jsonc
"dsh": {
  "client": { "platform": "web", "inject": [] },  // inject=必须先加载的其他客户端包
  "bundle": { "patch": ["./cordis.patch.yml"] }
}
```

- 免声明基线 external（可 require）：`react`、`react/jsx-runtime`、`react-dom(/client)`、`@deepseek-ai/cordis`、`dsh-client-store`、`dsh-client-ui-slots`、`dsh-client-ui-primitives`、`dsh-client-ui-dockkit`。
- **`dsh.client.external` 是逐字符串精确匹配**；其余第三方库直接打进 bundle。
- 仓库内 purity gate 会拦截非白名单 `@deepseek-ai/*` 值导入；外部包自建构建器没这道门，但规则仍要遵守：**跨包行为走 cordis 服务，UI 走 slots，类型走 `import type`（会被擦除）**。

### 3. tsdown 双面构建（复刻 clientBundle preset）

见任一插件的 `tsdown.config.ts`。要点：
- Host 面：`format esm + platform node + entryFileNames 'index.js'`（默认会产出 .mjs，必须显式指定）+ `external: /^@deepseek-ai\//`。
- Client 面：`format cjs + platform browser + entryFileNames 'client.js'` + banner/intro/footer 三件套 + `define` 三件套（`process.env.NODE_ENV`、`import.meta.env.MODE`、`import.meta.env`——CJS 输出带不了裸 `import.meta`）。
- **不要开 `dts: true`**（实测会让构建挂死）；外部包不需要 lib/types。
- tsdown 0.22 的 `intro` 键不存在，intro 内容并进 banner。
- `external` 是废弃键但可用，新写法 `deps.neverBundle`。

### 4. 依赖解析：符号链接借用仓库

插件不在 pnpm workspace 里，npm 上的 `@deepseek-ai/*` 版本又与仓库严重脱节（如 ui-primitives npm 上是 0.0.1-rc.1，仓库 0.1.7-alpha.1）。**方案：`node_modules/@deepseek-ai/*` 符号链接指到仓库的真实包**，`react/@types` 链到仓库 `.pnpm` store，另外链 `tsdown`/`typescript`/`tsx` 本体。见 `setup-links.sh`。

**迁移插件的坑**：相对符号链接（`../../../vendor/cordis`）在移动目录后全部失效——链接用绝对路径最稳（本仓库 setup-links.sh 即如此），或移动后必须重跑。

## Host 半边模式

### 数据通道选择
- **`ctx.webServer.register({kind:'exact', path, handler})` 出 JSON + 客户端 `fetch`** —— 外部包首选（无 codegen）。handler 签名 `(req: IncomingMessage, res: ServerResponse)`，自己 writeHead/end。服务键是 **`webServer`**（大小写敏感！inject 声明与 ctx 属性一致）。
- Typert `@Remote` 是正式路径但需要 codegen，且 `GENERATED_REMOTE` 构建门只放行仓库内包，外部包别碰。

### Config schema
```ts
export interface Config { symbols: string; source: 'auto' | ... }
export const Config = z.object({
  symbols: z.string().volatile().default('...'),          // volatile() = 设置页热更新
  source: z.union(['auto','eastmoney',...] as const).volatile().default('auto'),  // 没有 z.enum！用 z.union + 字面量
  apiKeyRef: z.string().role('credential-ref').default('ZAI_CODING_CN_API_KEY'),   // 凭据引用，非明文
})
```
- **必须 re-export `Config`**；schema 由设置页/Plugins 页读取渲染表单。
- **`volatile()` 字段到达插件时是 `Volatile<T>` 引用对象，不是原始值**——必须 `.get()` 读取（如 `config.symbols.get().split(...)`）。直接当原始值用会得到运行时 TypeError，且 webserver 兜底把 handler 异常变成裸 400，日志还不明显。两个防御：① Config 接口类型写成 `Volatile<string>` 让 tsc 拦住误用；② handler 内自捕获异常并把错误文本放进 200 JSON 响应，调试时一眼看到真因。
- 凭据：运行时每次 `await ctx.credentials.resolve(ref)`（返回 `{value, source} | undefined`），**绝不缓存、绝不明文、绝不入日志**。凭据库存于 `$DSH_HOME/.credentials.yaml` 的 `refs:` 段（简单键值）。

## Client 半边模式

```ts
export const inject = ['slots', 'locale']
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('em.quotes', { en, zh }), 'label')  // i18n gate：先注册字典
  const t = ctx.locale.bind('em.quotes')
  // 快照存 apply 闭包；publish 通知 listeners；setInterval 轮询记得 ctx.effect(() => () => clearInterval(...))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'em-quotes', order: 41,
    label: () => t('nav'), locale: 'em.quotes', inject: () => operations,
  }, MySection))
}
```

- **注册进别人声明的槽必须 `ctx.slots.inject(key, cb)`**（生命周期跟随声明者）；list 槽要 `id`。
- 注册项 `inject: () => ops` 里的保留字 **`hooks: { key: {getSnapshot, subscribe} }` 会被渲染器自动变成组件 prop `useKey(selector)`**。
- 注册项声明 `locale: 'ns'` → 组件收到 `t` prop。
- **组件永不接收 ctx**，不 import 其他插件，不用 `.module.css`（外部构建器没有 lightningcss 管线），样式用 inline style + `var(--dsw-*)` 主题 token（带 fallback 值）。
- 可用槽位见 `docs/subsystems/slots.md` 的层级树。已验证可用的：`settings.section`、`conversation.input.left`。**`sidebar.footer.action` 有 overflow 裁剪，hover 弹窗会被截断，别用**。

## 数据源经验（行情类）

- **东财 `push2.eastmoney.com/api/qt/ulist.np/get`**：字段 f2 价/f3 涨跌%/f4 涨跌额/f5 量(手)/f6 额(元)/f12 代码/f13 市场/f14 名称/f15 高/f16 低/f17 开/f18 昨收；`fltt=2` 返回小数；响应有 `{data:{diff:[...]}}` 包裹。**边缘 WAF 会拒绝裸程序化客户端（连 HTTP 明文都 tarpit，IP 级临时封禁几分钟到更久）**——必须带浏览器 UA+Referer，且要有降级源。
- **腾讯 `qt.gtimg.cn/q=sh600519`**：GBK 编码（`TextDecoder('gbk')` Node/浏览器都支持），`~` 分隔，[3]价[4]昨收[5]开[6]量(手)[31]涨跌额[32]涨跌%[33]高[34]低[37]额(万)。对 Node fetch 友好，**最稳的备用源**。
- **新浪 `hq.sinajs.cn/list=`**：GBK，必须带 `referer: https://finance.sina.com.cn`，无涨跌列需自算。
- 东财搜索 `searchapi.eastmoney.com/api/suggest/get` 后端不稳定：负载均衡会随机切到股吧用户搜索（passportWeb），需要 `x-requested-with: XMLHttpRequest` 且仍偶发；**搜索主源用腾讯 `smartbox.gtimg.cn/s3/?v=2&q=`**（GBK、支持拼音/中文/代码，条目 `~` 分隔 `^` 结尾，字段 [0]市场 [1]代码 [2]名称 [4]类型）。
- 腾讯 smartbox/行情的字符串带字面 `\uXXXX` 转义，需二次解码（`String.fromCharCode(parseInt(hex,16))`）。
- 教训：**调试期高频请求会触发限流**，开发时多用一次性验证；产品轮询 10s×几只标的是安全的。
- 教训：**多市场代码回写**——行情源回显的是市场内代码（如 `00100`），存储的是带前缀符号（`hk00100`），解析→回写需要一层 providerCode↔storedSymbol 映射，否则行会被静默过滤。

## 构建/环境坑清单（macOS）

1. **PATH**：会话里 PATH 可能被重置，一律显式 `export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:/usr/local/bin:$PATH"`。注意 `/usr/local/bin/node` 是 22.17（不满足仓库 engines ^22.19），要用 nvm 的 22.19。
2. **pnpm**：仓库 pin `pnpm@11.7.0`（`allowBuilds` 字段只有 11 认识）。pnpm 10 会忽略 allowBuilds 导致 esbuild/node-pty/koffi 等原生构建被跳过。装法：`PNPM_HOME=<workspace>/.pnpm-home pnpm add -g pnpm@11.7.0`，之后 `PATH="$PWD/.pnpm-home:$PATH"`。pnpm 11 重建 node_modules 需 `CI=true` 免 TTY 确认。
3. **npmmirror**：`npm_config_registry=https://registry.npmmirror.com` + `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`，全量 install 从无法完成降到 2 分钟。
4. **SDK 冲突**：CLT 的 MacOSX27.0.sdk 的 tbd（arm64e.x1）配旧 tapi 会链接失败，构建时 `export SDKROOT=/Applications/Xcode.app/.../MacOSX26.4.sdk`。
5. **长任务被杀**：会话中断会杀前台/后台命令，安装/构建用 `nohup script.sh & disown` 脱管 + 日志文件轮询。
6. **沙箱**：默认 workspace-write 下 `~/.dsh` 不可写——web 调试用 `export DSH_HOME=$PWD/.dev-home`（记得拷贝 `.credentials.yaml` 并 chmod 600，用完删）。

## 调试路径

```sh
./setup-links.sh                                  # 重建符号链接
cd <plugin> && node node_modules/tsdown/dist/run.mjs
DSH_HOME=$PWD/.dev-home pnpm dsh web              # web profile 调试（桌面 profile 是 Electron 专有，CLI 禁操作）
# 验证 Host 路由：curl http://127.0.0.1:3080/<route>
# 验证 client 下发：先 GET /?token=xxx 拿 boot graph 里通告的 rev，再 GET /plugins/??<pkg>/client.js&rev=<rev>
```

桌面端验证由用户在 Plugins 页面从本地路径安装（`dsh.bundle` 声明使安装即挂载，Electron 专有 profile，CLI `dsh plugin` 对 desktop 名会拒绝）。

## 已验证可复用的两个实现

| 插件 | 模式 | 特色 |
|---|---|---|
| `glm-usage-plugin` | 凭据引用 + 外部 API + 环形进度 + hover 弹窗 + 三处 UI 位 | credential-ref、状态点、主题 token 配色阈值 |
| `eastmoney-quotes-panel` | 公开 API + 三源降级 + 表格轮询 | GBK 解码、字段派生、WAF 规避、Volatile 配置读取 |

新插件按此模板复制目录结构 → 改 package.json 的 name/banner id → setup-links.sh → 写 src → tsdown 构建 → 安装测试。
