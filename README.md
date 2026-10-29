# 听江声 RiverLine · 工作脉络看板

以「脉络」视角管理推进中工作的看板应用。待办清单工具关注「列清单、打勾」，听江声关注一件复杂工作如何分叉、推进、汇报。

## 核心功能

- **主线 / 支线脉络**：任意节点 Fork 出并行支线，支线可汇合、可结束，汇合点一目了然
- **蓝图模式**：复杂工作先排好节点再启动，支持孵化（按蓝图建工作）与复制
- **停滞预警**：主线与支线超过 3 天没有新记录，卡片自动挂上预警
- **交付对象**：记录每项工作的汇报人（选填），方便随时找人沟通
- **撤销 / 重做**：脉络修改可回退
- **分类与任务分级**：二级分类目录、三档任务分级、搜索与排序

## 技术栈

- Next.js 16（App Router、Turbopack、Server Components）
- React 19 · Tailwind CSS 4 · TypeScript
- node:sqlite（WAL 模式），API Routes 直连数据库
- pnpm

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000 。Windows 下也可直接双击 `TJS_run.bat`。

## 数据说明

工作数据存于 `data/kanban.db`（SQLite），该目录已加入 `.gitignore`，不进入版本库。首次启动自动建表；列结构变更由启动时的补列迁移完成，旧库可直接沿用。
