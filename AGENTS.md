# AGENTS.md

本仓库中 agent 的工作笔记。

## DSH 外壳 API

- 写 host 路由/RPC、注册面板或侧栏入口、调用外壳服务（目录选择器、会话）、动颜色 token、或要查证外壳源码前，先读 `docs/agents/dsh-plugin-api.md`（已核实的接口形状、`/api` 两层信封、token island、asar 解包配方）。

## Agent 技能配置

### 工单（Issue tracker）

Issue 与 spec 作为 GitHub issue 存放在 `huangzj1996/dsh-workbench-engin`，用 `gh` CLI 管理。见 `docs/agents/issue-tracker.md`。

### 分诊标签（Triage labels）

分诊沿用默认的五个角色：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### 领域文档（Domain docs）

single-context：仓库根目录放一个 `GLOSSARY.md`，架构决策放 `docs/adr/`。见 `docs/agents/domain.md`。

## 插件构建（dsh-hello-word）

仓库根目录**就是**插件包（以 `link:` 形式安装进 `desktop` profile）。两半产物都由 `src/` 生成 —— 不要手改生成文件：

| 源码 | 产物 | 加载方 |
| --- | --- | --- |
| `src/client/index.ts`（含 `workbench.ts`、`sidebar-button.ts`） | `client.js` | 页面，作为一个 classic script 注册 `window.__ModuleLoader__.load({ id, factory })` |
| `src/host/index.ts` | `index.js` | 宿主，作为普通 ESM cordis 插件 |

- `npm run typecheck` —— `tsc --noEmit`（strict）
- `npm run check` —— 提交前必跑：typecheck + vitest + build + 词汇检查 + 按钮 token 检查
- `npm run build` —— 类型检查 + esbuild；会断言 ModuleLoader 方言、产物 id、hero 着色器与 locale 文案
- `npm run dev` —— watch `src/client/**` → `client.js`；改 host 半边后需重跑一次 build
- 运行时依赖：无。`react` 由页面提供（external）；`esbuild` / `typescript` 只是 devDependencies。

### 重新加载重建后的前端 bundle

宿主每次**激活**只读取一次插件的 `client.js`，并按该快照从 `/plugins/??<包名>/client.js&rev=<rev>` 提供。运行中的页面会一直使用旧字节，直到插件被重新激活：

- `plugin_manager set_bundle` 关 → 开（重新激活并推送新模块图），或
- 按 App 的刷新按钮（「Agent 可以自己刷新」入口默认关闭）。

没有浏览器控制时的验证方式：按文件 `mtime/ctime/size` 算出产物 rev，`GET /plugins/??dsh-hello-word/client.js&rev=<rev>`，再查实时 Client `Slots` 里的 `main` / `hello-word`。

### 面板契约

- main 面板 key：`hello-word`（侧栏行的 id 也指向同一个 key）
- 侧栏入口：克隆 shell 自己的「新会话」按钮做 DOM 组合（`src/client/sidebar-button.ts`）。它依赖 shell 的 CSS-module 类名后缀（`_newSession`、`_logoRow`），**跨版本脆弱** —— 有正式 slot 时优先用 slot。
- 面板内容：复刻 `https://www.deepseek.com/harness/` 的 hero 背景（CSS 径向渐变 + mask + WebGL2 流体着色器；30fps、后备画布 ≤1.4MP、离屏/隐藏时暂停、减少动效时只画一帧），上面叠工作台创建流程。

### 生成文件，不是手写源码

`client.js` 与 `index.js` 是构建产物。并行会话曾直接改过它们：这类改动要迁回 `src/**`，重新构建后再提交。

## 2026-11-04 完成的工作

- 搭起 `dsh-hello-word` bundle：Host row + 侧栏入口 + `main` 面板，以 `link:` 依赖安装进 `desktop` profile。
- 在面板里复刻官网落地页 hero 背景：CSS 径向渐变兜底、mask、1.8s 渐显，加 WebGL2 simplex-noise 流体着色器（uniform 循环、bloom、暖光、暗角、噪点），并做可见性、分辨率与减少动效保护。
- 面板可见文案先改为 工作台 / Workbench，随后把静态文案换成创建工作台流程：提示在上、创建按钮居中，弹框含名称输入、取消/创建、Enter/Esc 处理，创建后展示并记住该工作台。
- 仓库转为 TypeScript：`src/client/**` + `src/host/**`、strict `tsconfig.json`、`scripts/build.mjs`（tsc 门禁 + esbuild）产出 `client.js` / `index.js`；新增 devDependencies 与 lockfile。
- 以 `079d515`（`feat: move bundle sources to TypeScript and add a workbench creation flow`）提交并推送。
