# 工作台是一份 JSON 文件，存放在用户选定的根目录下

工作台的数据模型直接采用公开版场景配置的结构（`id` / `name` / `description` / `cols` / `panels[]`，子面板字段见文档），并以**磁盘 JSON 为唯一权威**。首次创建工作台时由用户选定一个根目录，布局是根目录下的 `index.json` 加每个工作台一个 `<id>/` 目录（目录名 = id），工作台配置写在该目录的 `<id>.json`，另带一份 `<id>-context.md` 定位卡。

`index.json` 存 `{ version, workbenches: [{ id, order }] }`：版本号加每项的登记与顺序，打开工作台面板时与目录扫描**对账**：目录有而未登记则补登记，登记了而目录不在则标记缺失、不自动删除。权威在文件、顺序在索引 —— 这样 AI 或人手写目录也能被发现，顺序又不会随目录扫描漂移。

写盘由 Host 半边完成：Host 注册 `connection` 的 Fetch/RPC 通道（`ctx.connection.fetch.register` / `ctx.get('connection').rpc` 模式，与已安装的 deck 插件同款），Client 通过同源 `/api` 调用，落到 `node:fs` 的原子写。没有选 `ctx.storageDomain`（KV + zod，落在 `~/.dsh/storages`，人和 AI 读不到可直接编辑的 JSON），也没有选 `localStorage`（AI 看不到、清缓存即丢）——两者都会推翻"JSON 是权威、AI 也能参与"这条前提。

根目录指针单独存放在 `~/.dsh/dsh-hello-word/config.json`：根目录可能在任意盘，而插件需要一个小配置记住它。

**后果**：改动 JSON 不需要重启 DSH（每次进入面板重新读）；同一视图内由 AI 在外部改动不会自动刷新，需要刷新动作；工作台 id 一旦确定不可改（改 id = 换一个工作台）。
