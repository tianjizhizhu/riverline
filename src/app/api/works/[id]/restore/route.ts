import { getWorkRow, restoreWork } from "@/lib/db";
import {
  ApiFail,
  cleanDate,
  cleanText,
  ok,
  parseId,
  readBody,
  route,
} from "@/lib/api-server";
import type {
  Difficulty,
  LineKind,
  LineStatus,
  NodeType,
  WorkSnapshot,
} from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const LINE_KINDS: LineKind[] = ["main", "branch"];
const LINE_STATUSES: LineStatus[] = ["active", "closed", "completed", "merged"];
const NODE_TYPES: NodeType[] = ["start", "progress", "merge"];
const DIFFICULTIES: Difficulty[] = ["water", "sparkling", "soda"];

const MAX_LINES = 100;
const MAX_NODES = 2000;
const MAX_MERGES = 500;

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function optId(v: unknown): number | null {
  return v === null || v === undefined ? null : isInt(v) ? v : NaN;
}

function strOrNull(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  return v.slice(0, max);
}

/** 严格解析撤销快照：字段类型、枚举白名单、跨表引用完整性、规模上限 */
function parseSnapshot(raw: unknown): WorkSnapshot {
  if (!raw || typeof raw !== "object") throw new ApiFail("快照数据格式有误");
  const s = raw as Record<string, unknown>;

  const work = s.work as Record<string, unknown> | undefined;
  if (!work || typeof work !== "object") throw new ApiFail("快照缺少工作信息");
  const title = typeof work.title === "string" ? work.title.trim() : "";
  const goal = typeof work.goal === "string" ? work.goal.trim() : "";
  if (!title) throw new ApiFail("快照工作名称为空");
  if (!goal) throw new ApiFail("快照目标为空");
  if (title.length > 50 || goal.length > 500) throw new ApiFail("快照字段超长");
  const deliverTo = cleanText(work.deliverTo, "交付对象", 50);
  const difficulty = DIFFICULTIES.includes(work.difficulty as Difficulty)
    ? (work.difficulty as Difficulty)
    : null;
  if (!difficulty) throw new ApiFail("快照任务分级无效");

  const rawLines = Array.isArray(s.lines) ? s.lines : null;
  const rawNodes = Array.isArray(s.nodes) ? s.nodes : null;
  const rawMerges = Array.isArray(s.merges) ? s.merges : null;
  if (!rawLines || !rawNodes || !rawMerges) throw new ApiFail("快照线路/节点数据缺失");
  if (rawLines.length > MAX_LINES) throw new ApiFail("快照线路数超限");
  if (rawNodes.length > MAX_NODES) throw new ApiFail("快照节点数超限");
  if (rawMerges.length > MAX_MERGES) throw new ApiFail("快照汇合记录数超限");

  const lines = rawLines.map((l) => {
    const r = (l ?? {}) as Record<string, unknown>;
    if (!isInt(r.id)) throw new ApiFail("快照线路 id 无效");
    if (!LINE_KINDS.includes(r.kind as LineKind)) throw new ApiFail("快照线路类型无效");
    if (!LINE_STATUSES.includes(r.status as LineStatus)) throw new ApiFail("快照线路状态无效");
    const name = typeof r.name === "string" ? r.name : "";
    if (name.length > 50) throw new ApiFail("快照线路名超长");
    const closedNote = strOrNull(r.closedNote, 500);
    const closedAt = strOrNull(r.closedAt, 10);
    return {
      id: r.id,
      kind: r.kind as LineKind,
      name,
      status: r.status as LineStatus,
      parentLineId: optId(r.parentLineId),
      forkNodeId: optId(r.forkNodeId),
      closedNote,
      closedAt,
    };
  });

  const lineIds = new Set(lines.map((l) => l.id));
  for (const l of lines) {
    if (l.parentLineId !== null && Number.isNaN(l.parentLineId)) {
      throw new ApiFail("快照线路父线路引用无效");
    }
    if (l.parentLineId !== null && !lineIds.has(l.parentLineId)) {
      throw new ApiFail("快照线路父线路引用不存在");
    }
  }

  const nodes = rawNodes.map((n) => {
    const r = (n ?? {}) as Record<string, unknown>;
    if (!isInt(r.id)) throw new ApiFail("快照节点 id 无效");
    if (!isInt(r.lineId)) throw new ApiFail("快照节点线路引用无效");
    if (!NODE_TYPES.includes(r.type as NodeType)) throw new ApiFail("快照节点类型无效");
    if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
      throw new ApiFail("快照节点日期无效");
    }
    if (typeof r.note !== "string" || typeof r.nextTask !== "string") {
      throw new ApiFail("快照节点内容格式有误");
    }
    if (r.note.length > 200 || r.nextTask.length > 200) throw new ApiFail("快照节点内容超长");
    if (!isInt(r.seq)) throw new ApiFail("快照节点序号无效");
    return {
      id: r.id,
      lineId: r.lineId,
      type: r.type as NodeType,
      date: r.date,
      note: r.note,
      nextTask: r.nextTask,
      fromBranchId: optId(r.fromBranchId),
      seq: r.seq,
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    if (!lineIds.has(n.lineId)) throw new ApiFail("快照节点线路引用不存在");
    if (n.fromBranchId !== null && Number.isNaN(n.fromBranchId)) {
      throw new ApiFail("快照节点来源分支引用无效");
    }
    if (n.fromBranchId !== null && !lineIds.has(n.fromBranchId)) {
      throw new ApiFail("快照节点来源分支引用不存在");
    }
  }
  for (const l of lines) {
    if (l.forkNodeId !== null && Number.isNaN(l.forkNodeId)) {
      throw new ApiFail("快照分支 Fork 点引用无效");
    }
    if (l.forkNodeId !== null && !nodeIds.has(l.forkNodeId)) {
      throw new ApiFail("快照分支 Fork 点引用不存在");
    }
  }

  const merges = rawMerges.map((m) => {
    const r = (m ?? {}) as Record<string, unknown>;
    if (!isInt(r.id)) throw new ApiFail("快照汇合记录 id 无效");
    if (!isInt(r.nodeId)) throw new ApiFail("快照汇合节点引用无效");
    if (!isInt(r.lineId)) throw new ApiFail("快照汇合分支引用无效");
    if (typeof r.note !== "string" || r.note.length > 500) {
      throw new ApiFail("快照汇合说明格式有误");
    }
    if (typeof r.closedAt !== "string" || r.closedAt.length > 10) {
      throw new ApiFail("快照汇合时间无效");
    }
    return {
      id: r.id,
      nodeId: r.nodeId,
      lineId: r.lineId,
      note: r.note,
      closedAt: r.closedAt,
    };
  });
  for (const m of merges) {
    if (!nodeIds.has(m.nodeId)) throw new ApiFail("快照汇合节点引用不存在");
    if (!lineIds.has(m.lineId)) throw new ApiFail("快照汇合分支引用不存在");
  }

  return {
    work: {
      title,
      goal,
      startDate: cleanDate(work.startDate, "快照开始日期"),
      dueDate:
        work.dueDate === null || work.dueDate === undefined
          ? null
          : cleanDate(work.dueDate, "快照目标日期"),
      categoryId:
        work.categoryId === null || work.categoryId === undefined
          ? null
          : isInt(work.categoryId)
            ? work.categoryId
            : NaN,
      difficulty,
      deliverTo,
    },
    lines,
    nodes,
    merges,
  };
}

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const workId = parseId(id, "工作");
    const work = getWorkRow(workId);
    if (!work) throw new ApiFail("工作不存在", 404);

    const body = await readBody(req);
    const snap = parseSnapshot(body.snapshot);
    if (snap.work.categoryId !== null && Number.isNaN(snap.work.categoryId)) {
      throw new ApiFail("快照分类引用无效");
    }
    restoreWork(workId, snap);
    return ok({ ok: true });
  });
}
