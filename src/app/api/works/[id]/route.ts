import {
  deleteWork,
  getBlueprintWithSpawn,
  getWorkRow,
  listLineRowsByWork,
  listMergeRowsByWork,
  listNodeRowsByWork,
  updateWork,
} from "@/lib/db";
import { workStatusOf } from "@/lib/derive";
import {
  ApiFail,
  cleanCategoryId,
  cleanDate,
  cleanDifficulty,
  cleanText,
  ok,
  parseId,
  readBody,
  route,
} from "@/lib/api-server";
import type { Difficulty } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const workId = parseId(id, "工作");
    const work = getWorkRow(workId);
    if (!work) throw new ApiFail("工作不存在", 404);
    return ok({
      work,
      lines: listLineRowsByWork(workId),
      nodes: listNodeRowsByWork(workId),
      // 汇合记录供撤销快照完整还原（说明与关闭时间不在节点行上）
      merges: listMergeRowsByWork(workId),
      // 记录任务指向其蓝图，供「打开蓝图」使用；其余情况为 null
      blueprint: work.blueprintId != null ? getBlueprintWithSpawn(work.blueprintId) : null,
    });
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const workId = parseId(id, "工作");
    const work = getWorkRow(workId);
    if (!work) throw new ApiFail("工作不存在", 404);

    const lines = listLineRowsByWork(workId);
    const nodes = listNodeRowsByWork(workId);
    if (workStatusOf(lines, nodes) === "done") {
      throw new ApiFail("工作已结束，先撤销结束再编辑");
    }

    const body = await readBody(req);
    const patch: {
      title?: string;
      goal?: string;
      dueDate?: string | null;
      categoryId?: number | null;
      difficulty?: Difficulty;
      deliverTo?: string;
    } = {};
    if (body.title !== undefined) patch.title = cleanText(body.title, "工作名称", 50, true);
    if (body.goal !== undefined) patch.goal = cleanText(body.goal, "目标", 500, true);
    if (body.dueDate !== undefined) {
      patch.dueDate = body.dueDate ? cleanDate(body.dueDate, "目标日期") : null;
    }
    if (body.categoryId !== undefined) patch.categoryId = cleanCategoryId(body.categoryId);
    if (body.difficulty !== undefined) {
      patch.difficulty = cleanDifficulty(body.difficulty, work.difficulty);
    }
    if (body.deliverTo !== undefined) {
      patch.deliverTo = cleanText(body.deliverTo, "交付对象", 50);
    }
    updateWork(workId, patch);
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const workId = parseId(id, "工作");
    const work = getWorkRow(workId);
    if (!work) throw new ApiFail("工作不存在", 404);
    // 蓝图删除只解除与记录任务的关联，记录任务本身保留
    deleteWork(workId);
    return ok({ ok: true });
  });
}
