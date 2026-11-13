部署背景、服务器清单与上线流程见公共文档：`C:\Users\Administrator\.trae-cn\shared\server-infra.md`

# 听江声工作看板（/riverline）

Next.js 16.4.2（`cacheComponents: true`），源码在 `src/`，数据库 `data/kanban.db`（`node:sqlite`）。线上 `/opt/riverline`、端口 4002、单元 `riverline.service`。

## 硬约束

- 子路径前缀由构建期 `NEXT_PUBLIC_BASE_PATH=/riverline` 注入，`next.config.ts` 的 `basePath` 读取该变量。改配置后必须重新 `pnpm build` 并重新部署。
- 所有站内接口请求必须走 `src/lib/api.ts`（内部已拼 `BASE_PATH` 前缀），不要直接写 `fetch('/api/...')`，否则线上 404。
- 图片与站内链接需带子路径前缀：服务端渲染的静态资源用绝对路径时手动加 `/riverline`，或用 `next/image` 由 basePath 处理。
- 本地调试端口固定 4002，启动用 `node node_modules/next/dist/bin/next dev -p 4002`；禁止占用 3000。
- 改动只有重新构建并部署后才在线上生效。

## 易错点

- `cacheComponents` 下页面默认静态预渲染，读取数据库的页面必须在 `src/app/page.tsx` 用 `connection()` 显式声明运行时渲染，否则数据被冻结在构建时刻。新增动态页面同样处理。
- `node:sqlite` 依赖 Node 内置模块，服务器 Node 24 可直接用；不要替换成 better-sqlite3 等原生模块。
- 写库后需要让看板立刻反映新数据，验证方式是看页面 HTML 是否已含新条目，而不是只看接口返回。
- 数据库文件是真实工作数据：清理测试数据用精确条件删除。
- 本地库 `data/kanban.db` 是 2026-11-09 从线上回传的快照副本，只作开发样本；线上为权威数据源，不要两边同时写入。同步前的本地副本在 `data/_before-sync_20261109/`。

## 收尾

完成任务后在本目录 `CHANGELOG.md` 顶部追加一条，字段为日期时间、执行者、改动摘要、涉及文件、部署状态（`本地完成未部署` 或 `已部署 + 验证结论`）。
