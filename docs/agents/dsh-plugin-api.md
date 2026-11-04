# DSH 外壳 API（本插件实际依赖的那部分）

本仓库是 DSH 插件包，不是独立应用：面板、宿主路由、外壳服务都通过 DSH 外壳的 cordis 上下文拿到。这份文档只记录**已核实**的接口形状与踩过的坑；每节末尾给出证据来源，外壳升级后按第 6 节重验。

**读它的时机**：要写/改 Host 路由或 RPC、注册面板或侧栏入口、调用外壳服务（目录选择器、会话）、动按钮/颜色 token、或者需要重新解包 `app.asar` 查证时。

---

## 1. Client 半边：槽位与面板

- 面板注册：`ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key, locale }, Component))`。`main` 是 **keyed** 槽，可注册多个 key，**同一时刻只渲染选中的那一个**。
- 切换面板：`ctx.layout.selectPanel(key)`；`null` 回到 Conversation。`ctx.layout` 只有 `selectPanel / beginNavigation / toggleSidebar / openRightbar / closeRightbar` 与 `panelInfo` 快照，**没有** 增删面板的 API。
- 列表槽（侧栏行）：`sidebar.panellist`（list），登记 `{ name: 'sidebar.panellist', id, order, label }`，组件收到 `{ size, active }`；**`id` 就是 `main` 的 key**，点行即切面板。
- 其它常用槽：`sidebar.footer.action`、`shell.overlay`（全帧浮层）、`shell.bottom`、`sidebar.settings`。没有 dialog/modal 槽；弹层用 `shell.overlay` 或自绘遮罩。
- React 由页面静态模块表提供（`require('react')`、`react-dom`），插件 bundle 里保持 external；没有外壳 UI 组件可 import。
- 外壳**没有**面板网格/切分：同一面板内多块子面板必须自己渲染（本插件用 CSS Grid）。

证据：`@deepseek-ai/dsh-client-ui-layout`、`dsh-client-ui-sidebar` README/`lib/client.js`（asar 内）；已安装 deck / skills-manager 插件的 `lib/client.js` 有同样的 `main` + `sidebar.panellist` 用法。

## 2. Host 半边：服务获取与通信

- 服务获取：`ctx.get(name)`（可能尚未就绪）或 `ctx.inject([names], cb)`（就绪后回调，可等待晚挂载的服务）。对象级 `inject` 可能把 `apply` 推迟甚至永不执行——可选服务优先 `ctx.get`，必须服务用 `ctx.inject`。
- 与浏览器通信的两条路，选 `connection`（带鉴权）：
  - `ctx.get('connection').fetch.register({ path, methods: ['POST'], requestBody: 'buffered', fetch })`：精确 Fetch 路由，挂在 `/api` 桥后面，浏览器 Cookie 鉴权与 Host/Origin 校验由外壳负责。
  - `ctx.get('connection').rpc.handle(channel, handler)`：通用 RPC 通道（本插件用前者 + `rpc.call`）。
- `ctx.webServer.register({ kind: 'exact' | 'prefix', path, handler })` 也能开路由，但**没有内建鉴权**，且 Electron `file://` 载具下没有 web server；仅作备选。
- 文件读写：直接用 `node:fs/promises`；用户目录按 `$DSH_HOME` → `~/.dsh` 解析；**不要**依赖 `@deepseek-ai/*` 包（安装成本高）。

### 2.1 `/api` RPC 的信封是**两层**（最容易写错的地方）

Client 侧 `ctx.get('connection').rpc.call('/api', '<endpoint>', call)`：

```text
请求 body： { type: 'client-request', rpcId, method: '<endpoint>', payload: { method, payload } }
响应 body： { type: 'server-response', rpcId, result: { ok: true, value } }
                                                          | { ok: false, error: { code, message, details } } }
```

- 外层 `method` 是**通道端点名**（如 `workbench`），真正的方法在 `payload.method`——按外层名派发会得到「未知的 RPC 方法」。
- Client 拿到的是 **`result`**（不是整个信封）。`details` 必须是对象，缺失会让 Client 报 envelope 错。
- 非 2xx → Client 抛 `transport failure`；`rpcId` 对不上 → 抛 `rpcId mismatch`；信封形状不对 → 抛 `connection: invalid server-response envelope`。
- 因此 Host 侧：能关联 `rpcId` 的畸形请求就用 `server-response` 信封回一个 `ok:false`（便于 UI 显示可读错误）；连 `rpcId` 都没有才回 400 纯文本。

证据：`@deepseek-ai/dsh-client-connection/lib/client.browser.js` 的 `createWebConnectionRpc` / `parseConnectionResponse`；已安装 deck 插件 `lib/rpcChannel.js` 的 `routeFetch` / `replyEnvelope`（可直接照抄的可用样例）。

## 3. 外壳服务：目录选择器与会话

- **目录选择器**：Host 服务 `ctx.directoryPicker`，`capability()` 返回
  - `{ kind: 'native', pick(signal) }`：弹系统文件夹框，返回绝对路径；取消返回 `null`
  - `{ kind: 'browse', list, createDirectory }`：应用内浏览，不能一次拿到一个绝对路径
  - 组合层是 `dsh-host-directory-picker-auto`：启动时 **一次** 采样，win32/darwin 本机 → native；非回环绑定 / SSH / 无桌面 → browse。服务可能晚于插件挂载，调用时惰性取或 `ctx.inject` 等。
- **会话**：Client 服务 `ctx.get('sessions').list.getSnapshot()` → `{ ids, byId, current }`，行含 `title / displayTitle / running / blank`；打开会话用 `ctx.get('uiWorkspace').openSession(sessionId)`。两者都可能晚就绪，取不到时给可读降级态。
- **本地小状态**：浏览器 `localStorage` 可用（多份 shipped 插件都这么做）；跨设备/跨端要落 Host 文件，则自己走 RPC 写盘。

证据：`dsh-host-directory-picker*`、`dsh-client-ui-workspace` README；`ctx.sessions` 的用法见已安装 deck / session-manager / unlag 的 `client.js`。

## 4. 主题 token 与深色画布（token island）

- 本插件画布是固定深色 hero，不随外壳明暗主题翻转。别名 token 会随主题变（light 下 `--dsw-alias-label-primary` 是近黑），直接在深色画布上用会「深底深字」。
- 做法：在面板根（`.dshwb-panel-root`）把按钮/文字用的别名 token **锁成深色值**（静态色板 `--dsw-static-*` + alpha 叠层），形成只作用于面板内部的 island。
- 颜色一律成对使用：主按钮 = `--dsw-alias-button-primary-fill` + `--dsw-alias-label-primary-foreground`；`--dsw-alias-brand-primary` 只当填充，**不**当文字色/焦点环。焦点环统一 `var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))`。
- 完整规范、token 真值表与迁移状态：`docs/design/button-system.md`（3.7 island、5.4 实施记录）。

## 5. 解包 `app.asar` 查证（外壳源码只在这里）

安装目录：`<DSH 安装>/resources/app.asar`（单文件，不能当目录读）。仓库外的 DSH 实现 checkout 路径以运行时上下文为准，同样可能是 asar 路径。

asar = 8 字节头 + JSON 头 + 拼接文件体：

```text
偏移 0..7   ： [uint32=4][uint32=headerSize]（pickle 头）
偏移 8..    ： headerSize 字节的 pickle： [uint32 stringLen][JSON]
数据起点    ： 8 + headerSize
条目        ： header.files 里每项 { size, offset }，offset 相对数据起点
```

按需解包（只取目标文件，别整包解）的最小脚本：

```js
import fs from 'node:fs';
const asar = '<app.asar 路径>';
const fd = fs.openSync(asar, 'r');
const b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0);
const headerSize = b.readUInt32LE(4);
const hb = Buffer.alloc(headerSize); fs.readSync(fd, hb, 0, headerSize, 8);
const strLen = hb.readUInt32LE(4);
const header = JSON.parse(hb.slice(8, 8 + strLen).toString('utf8'));
const dataOffset = 8 + headerSize;
// header.files 递归遍历，命中路径后：
// fs.readSync(fd, buf, 0, entry.size, dataOffset + Number(entry.offset));
```

查证优先级：先读包 README（`/dsh/node_modules/@deepseek-ai/<pkg>/README.md`，多数事实在这里）→ 再读 `lib/*.js`；**已安装插件的明文源码**（`~/.dsh/profiles/desktop/node_modules/*/lib/`）是"真实在跑"的最佳样例，优先照抄。

## 6. 外壳升级后重验（按顺序，别猜）

1. 跑 `npm run typecheck`、`npm test`、`npm run build`——契约测试（`src/host/workbench/__tests__/rpc.test.ts`）会先红。
2. 打开面板看是否还有"读取失败"；`/api` 路由失败会显示 `connection: invalid server-response envelope` 或 `未知的 RPC 方法`，按 §2.1 两层信封自查。
3. 目录选择器：点「选择文件夹…」；失败会降级为手填路径（`picker-unavailable` / `picker-failed`）。
4. 会话门牌：下拉应列真实会话，点门牌应切到该会话。
5. 主题：外壳切 light/dark，按钮文字与背景仍需可读（island 是否仍生效）。
6. 解包核对变化：`dsh-client-ui-layout`、`dsh-client-connection`、`dsh-host-directory-picker-auto` 的 README 与 `lib/client.browser.js` 的信封解析。

发现事实变化时，**先改这份文档、再改代码**，并在提交信息里注明重验的 DSH 版本。
