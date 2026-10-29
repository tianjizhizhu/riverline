import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { todayStr } from "./date";
import type {
  BlueprintSummary,
  Category,
  Difficulty,
  Line,
  LineKind,
  LineStatus,
  MergeRow,
  NodeRow,
  NodeType,
  Work,
  WorkMode,
  WorkSnapshot,
  WorkSummary,
} from "./types";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "kanban.db"));

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'branch',
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    parent_line_id INTEGER,
    fork_node_id INTEGER,
    closed_note TEXT,
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'progress',
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    next_task TEXT NOT NULL DEFAULT '',
    from_branch_id INTEGER,
    seq INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  /* 汇合记录：一个主线节点可被多条分支汇入，一行一次汇合 */
  CREATE TABLE IF NOT EXISTS merges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    line_id INTEGER NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    note TEXT NOT NULL DEFAULT '',
    closed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

/* 旧库补列：分类与分级 */
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Row[];
  if (!cols.some((c) => String(c.name) === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("works", "category_id", "category_id INTEGER");
ensureColumn("works", "difficulty", "difficulty TEXT NOT NULL DEFAULT 'water'");
ensureColumn("works", "mode", "mode TEXT NOT NULL DEFAULT 'record'");
ensureColumn("works", "blueprint_id", "blueprint_id INTEGER");
/* 交付对象（汇报人）：非必填，旧任务默认为空串 */
ensureColumn("works", "deliver_to", "deliver_to TEXT NOT NULL DEFAULT ''");
ensureColumn("categories", "parent_id", "parent_id INTEGER");

/* 旧库分类表带全局 UNIQUE(name)，二级目录需要同父级内唯一，重建一次。 */
const categoryDdl =
  (
    db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'")
      .get() as Row | undefined
  )?.sql ?? "";
if (String(categoryDdl).includes("name TEXT NOT NULL UNIQUE")) {
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE categories_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      INSERT INTO categories_new (id, name, parent_id, created_at)
        SELECT id, name, parent_id, created_at FROM categories;
      DROP TABLE categories;
      ALTER TABLE categories_new RENAME TO categories;
    `);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_parent_name ON categories (COALESCE(parent_id, 0), name)",
);
/* 一条分支最多汇合一次；旧库的 nodes.from_branch_id 补录成 merges 行 */
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_merges_line ON merges (line_id)");
db.exec(`
  INSERT OR IGNORE INTO merges (node_id, line_id, note, closed_at)
    SELECT n.id, n.from_branch_id, COALESCE(l.closed_note, ''), COALESCE(l.closed_at, datetime('now', 'localtime'))
    FROM nodes n JOIN lines l ON l.id = n.from_branch_id
    WHERE n.from_branch_id IS NOT NULL;
`);

type Row = Record<string, unknown>;

const DIFFICULTIES: Difficulty[] = ["water", "sparkling", "soda"];
const MODES: WorkMode[] = ["record", "blueprint"];

export function rowToWork(r: Row): Work {
  const difficulty = String(r.difficulty ?? "water") as Difficulty;
  const mode = String(r.mode ?? "record") as WorkMode;
  return {
    id: Number(r.id),
    title: String(r.title),
    goal: String(r.goal ?? ""),
    startDate: String(r.start_date),
    dueDate: r.due_date == null ? null : String(r.due_date),
    categoryId: r.category_id == null ? null : Number(r.category_id),
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : "water",
    mode: MODES.includes(mode) ? mode : "record",
    blueprintId: r.blueprint_id == null ? null : Number(r.blueprint_id),
    /** 交付对象（汇报人）：非必填，未填为空串 */
    deliverTo: String(r.deliver_to ?? ""),
    createdAt: String(r.created_at),
  };
}

export function rowToCategory(r: Row): Category {
  return {
    id: Number(r.id),
    name: String(r.name),
    parentId: r.parent_id == null ? null : Number(r.parent_id),
    createdAt: String(r.created_at),
  };
}

export function rowToLine(r: Row): Line {
  return {
    id: Number(r.id),
    workId: Number(r.work_id),
    kind: (r.kind === "main" ? "main" : "branch") as LineKind,
    name: String(r.name),
    status: (["active", "closed", "completed", "merged"].includes(String(r.status))
      ? String(r.status)
      : "active") as LineStatus,
    parentLineId: r.parent_line_id == null ? null : Number(r.parent_line_id),
    forkNodeId: r.fork_node_id == null ? null : Number(r.fork_node_id),
    closedNote: r.closed_note == null ? null : String(r.closed_note),
    closedAt: r.closed_at == null ? null : String(r.closed_at),
    createdAt: String(r.created_at),
  };
}

/** 按节点汇总汇合进来的分支，按汇合先后排序 */
function mergesByNode(nodeIds: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  if (nodeIds.length === 0) return map;
  const marks = nodeIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT node_id, line_id FROM merges WHERE node_id IN (${marks}) ORDER BY id ASC`)
    .all(...nodeIds) as Row[];
  for (const r of rows) {
    const key = Number(r.node_id);
    const list = map.get(key) ?? [];
    list.push(Number(r.line_id));
    map.set(key, list);
  }
  return map;
}

export function rowToNode(r: Row, mergedBranchIds: number[] = []): NodeRow {
  return {
    id: Number(r.id),
    lineId: Number(r.line_id),
    type: (["start", "progress", "merge"].includes(String(r.type))
      ? String(r.type)
      : "progress") as NodeType,
    date: String(r.date),
    note: String(r.note ?? ""),
    nextTask: String(r.next_task ?? ""),
    fromBranchId:
      mergedBranchIds[0] ??
      (r.from_branch_id == null ? null : Number(r.from_branch_id)),
    mergedBranchIds,
    seq: Number(r.seq),
    createdAt: String(r.created_at),
  };
}

/* ---------------- 查询 ---------------- */

export function listWorkRows(): Work[] {
  const rows = db
    .prepare("SELECT * FROM works ORDER BY created_at DESC, id DESC")
    .all() as Row[];
  return rows.map(rowToWork);
}

export function getWorkRow(id: number): Work | null {
  const r = db.prepare("SELECT * FROM works WHERE id = ?").get(id) as Row | undefined;
  return r ? rowToWork(r) : null;
}

/* ---------------- 分类 ---------------- */

export function listCategories(): Category[] {
  const rows = db
    .prepare("SELECT * FROM categories ORDER BY created_at ASC, id ASC")
    .all() as Row[];
  return rows.map(rowToCategory);
}

export function getCategoryRow(id: number): Category | null {
  const r = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as
    | Row
    | undefined;
  return r ? rowToCategory(r) : null;
}

export function createCategory(name: string, parentId: number | null): number {
  const r = db
    .prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)")
    .run(name, parentId);
  return Number(r.lastInsertRowid);
}

export function renameCategory(id: number, name: string): void {
  db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
}

export function deleteCategory(id: number): void {
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE works SET category_id = NULL WHERE category_id = ?").run(id);
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function hasChildCategory(id: number): boolean {
  const r = db
    .prepare("SELECT EXISTS (SELECT 1 FROM categories WHERE parent_id = ?) AS has")
    .get(id) as Row;
  return Number(r.has) === 1;
}

export function listLineRowsByWork(workId: number): Line[] {
  const rows = db
    .prepare(
      "SELECT * FROM lines WHERE work_id = ? ORDER BY CASE kind WHEN 'main' THEN 0 ELSE 1 END, created_at ASC, id ASC",
    )
    .all(workId) as Row[];
  return rows.map(rowToLine);
}

export function getLineRow(id: number): Line | null {
  const r = db.prepare("SELECT * FROM lines WHERE id = ?").get(id) as Row | undefined;
  return r ? rowToLine(r) : null;
}

export function listNodeRowsByWork(workId: number): NodeRow[] {
  const rows = db
    .prepare(
      `SELECT n.* FROM nodes n JOIN lines l ON n.line_id = l.id
       WHERE l.work_id = ? ORDER BY n.line_id ASC, n.seq ASC, n.id ASC`,
    )
    .all(workId) as Row[];
  const merged = mergesByNode(rows.map((r) => Number(r.id)));
  return rows.map((r) => rowToNode(r, merged.get(Number(r.id)) ?? []));
}

export function listNodeRowsByLine(lineId: number): NodeRow[] {
  const rows = db
    .prepare("SELECT * FROM nodes WHERE line_id = ? ORDER BY seq ASC, id ASC")
    .all(lineId) as Row[];
  const merged = mergesByNode(rows.map((r) => Number(r.id)));
  return rows.map((r) => rowToNode(r, merged.get(Number(r.id)) ?? []));
}

export function getNodeRow(id: number): NodeRow | null {
  const r = db.prepare("SELECT * FROM nodes WHERE id = ?").get(id) as Row | undefined;
  if (!r) return null;
  const merged = mergesByNode([Number(r.id)]);
  return rowToNode(r, merged.get(Number(r.id)) ?? []);
}

export function nextSeq(lineId: number): number {
  const r = db
    .prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS s FROM nodes WHERE line_id = ?")
    .get(lineId) as Row;
  return Number(r.s);
}

/* ---------------- 写入 ---------------- */

export function createWork(input: {
  title: string;
  goal: string;
  startDate: string;
  dueDate: string | null;
  categoryId: number | null;
  difficulty: Difficulty;
  firstTask: string;
  mode?: WorkMode;
  /** 交付对象（汇报人），非必填 */
  deliverTo?: string;
}): number {
  db.exec("BEGIN");
  try {
    const w = db
      .prepare(
        `INSERT INTO works (title, goal, start_date, due_date, category_id, difficulty, mode, deliver_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.goal,
        input.startDate,
        input.dueDate,
        input.categoryId,
        input.difficulty,
        input.mode ?? "record",
        input.deliverTo ?? "",
      );
    const workId = Number(w.lastInsertRowid);
    const l = db
      .prepare("INSERT INTO lines (work_id, kind, name, status) VALUES (?, 'main', '主线', 'active')")
      .run(workId);
    const lineId = Number(l.lastInsertRowid);
    db.prepare(
      "INSERT INTO nodes (line_id, type, date, note, next_task, seq) VALUES (?, 'start', ?, '', ?, 1)",
    ).run(lineId, input.startDate, input.firstTask);
    db.exec("COMMIT");
    return workId;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** 蓝图是否已孵化：存在反向关联的记录任务。 */
export function blueprintSpawned(blueprintId: number): boolean {
  const r = db
    .prepare("SELECT EXISTS (SELECT 1 FROM works WHERE blueprint_id = ?) AS has")
    .get(blueprintId) as Row;
  return Number(r.has) === 1;
}

/**
 * 蓝图孵化为记录任务：只带入主线的开始节点，之后由使用者对照蓝图自行填写。
 * 这样蓝图初期规划不周时无需回头改记录任务，改蓝图即可。
 * 新记录任务与蓝图一对一关联，复制在单事务内完成，失败整体回滚。
 */
export function spawnWorkFromBlueprint(blueprintId: number): number {
  const blueprint = getWorkRow(blueprintId);
  if (!blueprint) throw new Error("蓝图不存在");
  if (blueprint.mode !== "blueprint") throw new Error("只有蓝图可以生成记录");
  if (blueprintSpawned(blueprintId)) throw new Error("该蓝图已生成过记录任务");

  const bpLines = listLineRowsByWork(blueprintId);
  const main = bpLines.find((l) => l.kind === "main") ?? bpLines[0];
  if (!main) throw new Error("蓝图没有主线，无法生成记录");

  const bpNodes = listNodeRowsByWork(blueprintId).filter((n) => n.lineId === main.id);
  const startNode = bpNodes.find((n) => n.type === "start") ?? bpNodes[0];

  db.exec("BEGIN");
  try {
    const w = db
      .prepare(
        `INSERT INTO works (title, goal, start_date, due_date, category_id, difficulty, mode, blueprint_id, deliver_to)
         VALUES (?, ?, ?, ?, ?, ?, 'record', ?, ?)`,
      )
      .run(
        blueprint.title,
        blueprint.goal,
        todayStr(),
        blueprint.dueDate,
        blueprint.categoryId,
        blueprint.difficulty,
        blueprintId,
        blueprint.deliverTo,
      );
    const workId = Number(w.lastInsertRowid);

    const l = db
      .prepare("INSERT INTO lines (work_id, kind, name, status) VALUES (?, 'main', ?, 'active')")
      .run(workId, main.name);
    const lineId = Number(l.lastInsertRowid);

    // 只带入开始节点：后续节点由使用者在记录任务里对照蓝图自行填写
    if (startNode) {
      db.prepare(
        `INSERT INTO nodes (line_id, type, date, note, next_task, from_branch_id, seq)
         VALUES (?, 'start', ?, ?, ?, NULL, 1)`,
      ).run(lineId, startNode.date, startNode.note, startNode.nextTask);
    }

    db.exec("COMMIT");
    return workId;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function updateWork(
  id: number,
  patch: {
    title?: string;
    goal?: string;
    dueDate?: string | null;
    categoryId?: number | null;
    difficulty?: Difficulty;
    deliverTo?: string;
  },
): void {
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (patch.title !== undefined) {
    fields.push("title = ?");
    values.push(patch.title);
  }
  if (patch.goal !== undefined) {
    fields.push("goal = ?");
    values.push(patch.goal);
  }
  if (patch.dueDate !== undefined) {
    fields.push("due_date = ?");
    values.push(patch.dueDate);
  }
  if (patch.categoryId !== undefined) {
    fields.push("category_id = ?");
    values.push(patch.categoryId);
  }
  if (patch.difficulty !== undefined) {
    fields.push("difficulty = ?");
    values.push(patch.difficulty);
  }
  if (patch.deliverTo !== undefined) {
    fields.push("deliver_to = ?");
    values.push(patch.deliverTo);
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE works SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteWork(id: number): void {
  db.exec("BEGIN");
  try {
    // 记录任务删除后，其蓝图解除关联（不再显示为已生成记录）
    db.prepare("UPDATE works SET blueprint_id = NULL WHERE blueprint_id = ?").run(id);
    db.prepare("DELETE FROM works WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function appendNode(input: {
  lineId: number;
  type: NodeType;
  date: string;
  note: string;
  nextTask: string;
  fromBranchId?: number | null;
}): NodeRow {
  const seq = nextSeq(input.lineId);
  const r = db
    .prepare(
      `INSERT INTO nodes (line_id, type, date, note, next_task, from_branch_id, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.lineId,
      input.type,
      input.date,
      input.note,
      input.nextTask,
      input.fromBranchId ?? null,
      seq,
    );
  const node = getNodeRow(Number(r.lastInsertRowid));
  if (!node) throw new Error("节点写入失败");
  return node;
}

export function createBranch(input: {
  workId: number;
  parentLineId: number;
  forkNodeId: number;
  name: string;
  date: string;
  firstTask: string;
}): number {
  db.exec("BEGIN");
  try {
    const l = db
      .prepare(
        `INSERT INTO lines (work_id, kind, name, status, parent_line_id, fork_node_id)
         VALUES (?, 'branch', ?, 'active', ?, ?)`,
      )
      .run(input.workId, input.name, input.parentLineId, input.forkNodeId);
    const lineId = Number(l.lastInsertRowid);
    db.prepare(
      "INSERT INTO nodes (line_id, type, date, note, next_task, seq) VALUES (?, 'start', ?, '', ?, 1)",
    ).run(lineId, input.date, input.firstTask);
    db.exec("COMMIT");
    return lineId;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function closeLine(lineId: number, note: string): void {
  db.prepare(
    "UPDATE lines SET status = 'closed', closed_note = ?, closed_at = date('now', 'localtime') WHERE id = ?",
  ).run(note, lineId);
}

export function reopenLine(lineId: number): void {
  db.prepare(
    "UPDATE lines SET status = 'active', closed_note = NULL, closed_at = NULL WHERE id = ?",
  ).run(lineId);
}

export function completeLine(lineId: number, note: string): void {
  db.prepare(
    "UPDATE lines SET status = 'completed', closed_note = ?, closed_at = date('now', 'localtime') WHERE id = ?",
  ).run(note, lineId);
}

/** 把分支汇合到主线上的既有节点：该节点标记为汇合点，分支转为 merged。同一节点可被多条分支汇入。 */
export function mergeBranchIntoNode(lineId: number, nodeId: number, note: string): void {
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO merges (node_id, line_id, note) VALUES (?, ?, ?)").run(
      nodeId,
      lineId,
      note,
    );
    // from_branch_id 保留最早汇入的分支，供单分支场景直接展示
    db.prepare(
      "UPDATE nodes SET type = 'merge', from_branch_id = COALESCE(from_branch_id, ?) WHERE id = ?",
    ).run(lineId, nodeId);
    db.prepare(
      "UPDATE lines SET status = 'merged', closed_note = ?, closed_at = date('now', 'localtime') WHERE id = ?",
    ).run(note, lineId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** 撤销汇合：删掉这条分支的汇合记录，节点仍有其他分支汇入时保持汇合点。 */
export function unmergeBranch(lineId: number): void {
  db.exec("BEGIN");
  try {
    const targets = db
      .prepare("SELECT node_id FROM merges WHERE line_id = ?")
      .all(lineId) as Row[];
    db.prepare("DELETE FROM merges WHERE line_id = ?").run(lineId);
    for (const t of targets) {
      const nodeId = Number(t.node_id);
      const rest = db
        .prepare("SELECT line_id FROM merges WHERE node_id = ? ORDER BY id ASC LIMIT 1")
        .get(nodeId) as Row | undefined;
      if (rest) {
        db.prepare("UPDATE nodes SET type = 'merge', from_branch_id = ? WHERE id = ?").run(
          Number(rest.line_id),
          nodeId,
        );
      } else {
        db.prepare(
          "UPDATE nodes SET type = 'progress', from_branch_id = NULL WHERE id = ?",
        ).run(nodeId);
      }
    }
    db.prepare(
      "UPDATE lines SET status = 'active', closed_note = NULL, closed_at = NULL WHERE id = ?",
    ).run(lineId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function deleteNode(id: number): void {
  db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
}

/**
 * 复制蓝图：整套线路、节点、汇合原样拷贝成一份新蓝图，
 * 供同一套规划套路套到另一项研究上。新蓝图不带任何孵化关联。
 */
export function duplicateBlueprint(blueprintId: number, title: string): number {
  const bp = getWorkRow(blueprintId);
  if (!bp) throw new Error("蓝图不存在");
  if (bp.mode !== "blueprint") throw new Error("只有蓝图可以复制");

  const bpLines = listLineRowsByWork(blueprintId);
  const bpNodes = listNodeRowsByWork(blueprintId);
  const bpMerges = listMergeRowsByWork(blueprintId);

  db.exec("BEGIN");
  try {
    const w = db
      .prepare(
        `INSERT INTO works (title, goal, start_date, due_date, category_id, difficulty, mode, deliver_to)
         VALUES (?, ?, ?, ?, ?, ?, 'blueprint', ?)`,
      )
      .run(title, bp.goal, todayStr(), bp.dueDate, bp.categoryId, bp.difficulty, bp.deliverTo);
    const workId = Number(w.lastInsertRowid);

    // 主线先行插入，分支随后，保证 parent/fork 引用先有目标
    const lineMap = new Map<number, number>();
    const ordered = [...bpLines].sort(
      (a, b) =>
        (a.kind === "main" ? 0 : 1) - (b.kind === "main" ? 0 : 1) || a.id - b.id,
    );
    for (const l of ordered) {
      const nl = db
        .prepare(
          `INSERT INTO lines (work_id, kind, name, status, parent_line_id, fork_node_id, closed_note, closed_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
        )
        .run(
          workId,
          l.kind,
          l.name,
          l.status,
          l.parentLineId != null ? lineMap.get(l.parentLineId) ?? null : null,
          l.closedNote,
          l.closedAt,
        );
      lineMap.set(l.id, Number(nl.lastInsertRowid));
    }

    const nodeMap = new Map<number, number>();
    for (const n of bpNodes) {
      const nn = db
        .prepare(
          `INSERT INTO nodes (line_id, type, date, note, next_task, from_branch_id, seq)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          lineMap.get(n.lineId) ?? null,
          n.type,
          n.date,
          n.note,
          n.nextTask,
          n.fromBranchId != null ? lineMap.get(n.fromBranchId) ?? null : null,
          n.seq,
        );
      nodeMap.set(n.id, Number(nn.lastInsertRowid));
    }

    for (const l of bpLines) {
      if (l.forkNodeId == null) continue;
      const fork = nodeMap.get(l.forkNodeId);
      const lineId = lineMap.get(l.id);
      if (fork == null || lineId == null) continue;
      db.prepare("UPDATE lines SET fork_node_id = ? WHERE id = ?").run(fork, lineId);
    }

    for (const m of bpMerges) {
      const nodeId = nodeMap.get(m.nodeId);
      const lineId = lineMap.get(m.lineId);
      if (nodeId == null || lineId == null) continue;
      db.prepare(
        "INSERT INTO merges (node_id, line_id, note, closed_at) VALUES (?, ?, ?, ?)",
      ).run(nodeId, lineId, m.note, m.closedAt);
    }

    db.exec("COMMIT");
    return workId;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** 收集由种子节点 fork 出的分支，并沿父子关系递归展开 */
function expandBranchLines(lines: Line[], seedNodeIds: Set<number>): Set<number> {
  const out = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const l of lines) {
      if (l.kind !== "branch" || out.has(l.id)) continue;
      const forkGone = l.forkNodeId != null && seedNodeIds.has(l.forkNodeId);
      const parentGone = l.parentLineId != null && out.has(l.parentLineId);
      if (forkGone || parentGone) {
        out.add(l.id);
        changed = true;
      }
    }
  }
  return out;
}

/**
 * 删除节点。
 * downstream=false 仅删当前节点；true 连同该线路之后（含）的节点一起删。
 * branches="cascade" 时，从这些节点 fork 出的分支递归一并删除；
 * "keep" 时保留分支，其 Fork 点前移到删除位置之前最近的存活节点。
 */
export function deleteNodes(
  nodeId: number,
  opts: { downstream: boolean; branches: "cascade" | "keep" },
): { deletedNodes: number; deletedLines: number } {
  const node = getNodeRow(nodeId);
  if (!node) throw new Error("节点不存在");
  const line = getLineRow(node.lineId);
  if (!line) throw new Error("线路不存在");

  const lines = listLineRowsByWork(line.workId);
  const nodes = listNodeRowsByWork(line.workId);

  const delNodes = new Set<number>([node.id]);
  if (opts.downstream) {
    for (const n of nodes) {
      if (n.lineId === node.lineId && n.seq >= node.seq) delNodes.add(n.id);
    }
  }

  const delLines =
    opts.branches === "cascade" ? expandBranchLines(lines, delNodes) : new Set<number>();
  if (opts.branches === "cascade") {
    for (const l of lines) {
      if (!delLines.has(l.id)) continue;
      for (const n of nodes) if (n.lineId === l.id) delNodes.add(n.id);
    }
  }

  // 每条线路至少保留一个节点，避免出现空线路
  const remain = new Map<number, number>();
  for (const n of nodes) {
    if (delNodes.has(n.id)) continue;
    remain.set(n.lineId, (remain.get(n.lineId) ?? 0) + 1);
  }
  for (const l of lines) {
    if (delLines.has(l.id)) continue;
    if ((remain.get(l.id) ?? 0) === 0) {
      throw new Error(`「${l.name}」至少需要保留一个节点`);
    }
  }

  // 保留分支时，把 Fork 点改挂到删除位置之前最近的存活节点
  const reFork: Array<[number, number | null]> = [];
  if (opts.branches === "keep") {
    for (const l of lines) {
      if (l.kind !== "branch" || l.forkNodeId == null) continue;
      if (!delNodes.has(l.forkNodeId)) continue;
      const anchor = nodes
        .filter(
          (n) =>
            n.lineId === l.parentLineId &&
            !delNodes.has(n.id) &&
            n.seq < (nodes.find((x) => x.id === l.forkNodeId)?.seq ?? 0),
        )
        .sort((a, b) => b.seq - a.seq)[0];
      reFork.push([l.id, anchor?.id ?? null]);
    }
  }

  // 汇入被删节点的分支，解除汇合、回到进行中
  const mergedBack: number[] = [];
  for (const n of nodes) {
    if (!delNodes.has(n.id)) continue;
    for (const b of n.mergedBranchIds) mergedBack.push(b);
  }

  db.exec("BEGIN");
  try {
    if (delNodes.size > 0) {
      const marks = [...delNodes].map(() => "?").join(",");
      db.prepare(`DELETE FROM merges WHERE node_id IN (${marks})`).run(...delNodes);
      db.prepare(`DELETE FROM nodes WHERE id IN (${marks})`).run(...delNodes);
    }
    if (delLines.size > 0) {
      const marks = [...delLines].map(() => "?").join(",");
      db.prepare(`DELETE FROM lines WHERE id IN (${marks})`).run(...delLines);
    }
    for (const [lineId, forkNodeId] of reFork) {
      db.prepare("UPDATE lines SET fork_node_id = ? WHERE id = ?").run(forkNodeId, lineId);
    }
    for (const branchId of mergedBack) {
      db.prepare(
        "UPDATE lines SET status = 'active', closed_note = NULL, closed_at = NULL WHERE id = ?",
      ).run(branchId);
    }

    // 受影响线路的序号重排紧凑
    const affected = new Set<number>([node.lineId]);
    for (const n of nodes) if (delNodes.has(n.id)) affected.add(n.lineId);
    for (const lineId of affected) {
      if (delLines.has(lineId)) continue;
      const rest = db
        .prepare("SELECT id FROM nodes WHERE line_id = ? ORDER BY seq ASC, id ASC")
        .all(lineId) as Row[];
      rest.forEach((r, i) =>
        db.prepare("UPDATE nodes SET seq = ? WHERE id = ?").run(i + 1, Number(r.id)),
      );
    }

    // 起点被删时，同线路下一个存活节点升为起点
    if (node.type === "start") {
      const next = db
        .prepare(
          "SELECT id, type FROM nodes WHERE line_id = ? ORDER BY seq ASC, id ASC LIMIT 1",
        )
        .get(node.lineId) as Row | undefined;
      if (next && String(next.type) !== "start" && String(next.type) !== "merge") {
        db.prepare("UPDATE nodes SET type = 'start' WHERE id = ?").run(Number(next.id));
      }
    }

    // 重算汇合点标记：删除后节点可能不再是汇合点
    const left = db
      .prepare(
        `SELECT n.id, n.type FROM nodes n JOIN lines l ON n.line_id = l.id WHERE l.work_id = ?`,
      )
      .all(line.workId) as Row[];
    for (const r of left) {
      const id = Number(r.id);
      const m = db
        .prepare("SELECT line_id FROM merges WHERE node_id = ? ORDER BY id ASC LIMIT 1")
        .get(id) as Row | undefined;
      if (m) {
        if (String(r.type) !== "merge") {
          db.prepare("UPDATE nodes SET type = 'merge', from_branch_id = ? WHERE id = ?").run(
            Number(m.line_id),
            id,
          );
        }
      } else if (String(r.type) === "merge") {
        db.prepare("UPDATE nodes SET type = 'progress', from_branch_id = NULL WHERE id = ?").run(
          id,
        );
      }
    }

    db.exec("COMMIT");
    return { deletedNodes: delNodes.size, deletedLines: delLines.size };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** 在某节点之后插入一个空白进展节点，供随后补全内容、并在其上 Fork */
export function insertNodeAfter(nodeId: number): NodeRow {
  const node = getNodeRow(nodeId);
  if (!node) throw new Error("节点不存在");

  db.exec("BEGIN");
  try {
    db.prepare(
      "UPDATE nodes SET seq = seq + 1 WHERE line_id = ? AND seq > ?",
    ).run(node.lineId, node.seq);
    const r = db
      .prepare(
        `INSERT INTO nodes (line_id, type, date, note, next_task, seq)
         VALUES (?, 'progress', ?, '', '', ?)`,
      )
      .run(node.lineId, todayStr(), node.seq + 1);
    const created = getNodeRow(Number(r.lastInsertRowid));
    if (!created) throw new Error("节点写入失败");
    db.exec("COMMIT");
    return created;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listMergeRowsByWork(workId: number): MergeRow[] {
  const rows = db
    .prepare(
      `SELECT m.* FROM merges m
       JOIN nodes n ON m.node_id = n.id
       JOIN lines l ON n.line_id = l.id
       WHERE l.work_id = ? ORDER BY m.id ASC`,
    )
    .all(workId) as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    nodeId: Number(r.node_id),
    lineId: Number(r.line_id),
    note: String(r.note ?? ""),
    closedAt: String(r.closed_at),
  }));
}

/** 撤销/重做：按快照整体还原工作（线路、节点、汇合按原 id 重建） */
export function restoreWork(workId: number, snap: WorkSnapshot): void {
  db.exec("BEGIN");
  try {
    // 删线路即级联清掉节点与汇合记录，随后按快照原样重建
    db.prepare("DELETE FROM lines WHERE work_id = ?").run(workId);

    for (const l of snap.lines) {
      db.prepare(
        `INSERT INTO lines (id, work_id, kind, name, status, parent_line_id, fork_node_id, closed_note, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        l.id,
        workId,
        l.kind,
        l.name,
        l.status,
        l.parentLineId,
        l.forkNodeId,
        l.closedNote,
        l.closedAt,
      );
    }
    for (const n of snap.nodes) {
      db.prepare(
        `INSERT INTO nodes (id, line_id, type, date, note, next_task, from_branch_id, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(n.id, n.lineId, n.type, n.date, n.note, n.nextTask, n.fromBranchId, n.seq);
    }
    for (const m of snap.merges) {
      db.prepare(
        `INSERT INTO merges (id, node_id, line_id, note, closed_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(m.id, m.nodeId, m.lineId, m.note, m.closedAt);
    }

    db.prepare(
      `UPDATE works SET title = ?, goal = ?, start_date = ?, due_date = ?, category_id = ?, difficulty = ?, deliver_to = ?
       WHERE id = ?`,
    ).run(
      snap.work.title,
      snap.work.goal,
      snap.work.startDate,
      snap.work.dueDate,
      snap.work.categoryId,
      snap.work.difficulty,
      snap.work.deliverTo,
      workId,
    );

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function updateNode(
  id: number,
  patch: { date?: string; note?: string; nextTask?: string },
): void {
  const fields: string[] = [];
  const values: string[] = [];
  if (patch.date !== undefined) {
    fields.push("date = ?");
    values.push(patch.date);
  }
  if (patch.note !== undefined) {
    fields.push("note = ?");
    values.push(patch.note);
  }
  if (patch.nextTask !== undefined) {
    fields.push("next_task = ?");
    values.push(patch.nextTask);
  }
  if (fields.length === 0) return;
  values.push(String(id));
  db.prepare(`UPDATE nodes SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

/** 某工作孵化的记录任务，未孵化为 null */
export function getSpawnedWork(blueprintId: number): Work | null {
  const r = db
    .prepare("SELECT * FROM works WHERE blueprint_id = ? ORDER BY id ASC LIMIT 1")
    .get(blueprintId) as Row | undefined;
  return r ? rowToWork(r) : null;
}

/** 某蓝图（按 id）的详情，含其孵化的记录任务；用于「打开蓝图」弹窗 */
export function getBlueprintWithSpawn(
  blueprintId: number,
): { blueprint: Work; spawned: Work | null } | null {
  const blueprint = getWorkRow(blueprintId);
  if (!blueprint || blueprint.mode !== "blueprint") return null;
  return { blueprint, spawned: getSpawnedWork(blueprintId) };
}

/** 蓝图管理页：全部蓝图 + 孵化状态，按创建时间倒序 */
export function listBlueprintSummaries(): BlueprintSummary[] {
  const rows = db
    .prepare("SELECT * FROM works WHERE mode = 'blueprint' ORDER BY created_at DESC, id DESC")
    .all() as Row[];
  return rows.map((r) => {
    const work = rowToWork(r);
    const lines = listLineRowsByWork(work.id);
    const nodes = listNodeRowsByWork(work.id);
    const spawned = getSpawnedWork(work.id);
    const spawnedNodes = spawned ? listNodeRowsByWork(spawned.id) : [];
    const spawnedMain = spawned
      ? listLineRowsByWork(spawned.id).find((l) => l.kind === "main")
      : undefined;
    const spawnedTail = spawnedMain
      ? spawnedNodes.filter((n) => n.lineId === spawnedMain.id).slice(-1)[0]
      : undefined;
    return {
      work,
      nodeCount: nodes.length,
      branchTotal: lines.filter((l) => l.kind === "branch").length,
      spawned,
      spawnedCurrentTask: spawnedTail?.nextTask ?? "",
      spawnedNodeCount: spawnedNodes.length,
      // 蓝图完成状态跟随其记录任务：记录任务完成，蓝图即完成
      status:
        spawned && spawnedTail && spawnedTail.nextTask === "" ? "done" : "active",
    };
  });
}
