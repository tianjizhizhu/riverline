import {
  deleteNodes,
  getLineRow,
  getNodeRow,
  listLineRowsByWork,
  listNodeRowsByLine,
  listNodeRowsByWork,
  updateNode,
} from "@/lib/db";
import { workStatusOf } from "@/lib/derive";
import {
  ApiFail,
  cleanDate,
  cleanText,
  ok,
  parseId,
  readBody,
  route,
} from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const nodeId = parseId(id, "节点");
    const node = getNodeRow(nodeId);
    if (!node) throw new ApiFail("节点不存在", 404);

    const line = getLineRow(node.lineId);
    if (!line) throw new ApiFail("线路不存在", 404);

    const lines = listLineRowsByWork(line.workId);
    const allNodes = listNodeRowsByWork(line.workId);
    const status = workStatusOf(lines, allNodes);

    const body = await readBody(req);
    const patch: { date?: string; note?: string; nextTask?: string } = {};
    if (body.date !== undefined) patch.date = cleanDate(body.date, "日期");
    if (body.note !== undefined) patch.note = cleanText(body.note, "节点内容", 200);
    if (body.nextTask !== undefined) {
      patch.nextTask = cleanText(body.nextTask, "下一步任务", 200);
    }

    if (status === "done") {
      const main = lines.find((l) => l.kind === "main");
      const mainNodes = main ? listNodeRowsByLine(main.id) : [];
      const tail = mainNodes[mainNodes.length - 1];
      const isTailUndo =
        !!main &&
        line.id === main.id &&
        tail?.id === node.id &&
        patch.nextTask !== undefined &&
        patch.nextTask !== "";
      if (!isTailUndo) {
        throw new ApiFail("工作已结束，只能撤销结束或删除工作");
      }
      updateNode(nodeId, { nextTask: patch.nextTask });
      return ok({ ok: true });
    }

    if (Object.keys(patch).length === 0) throw new ApiFail("没有要更新的内容");
    updateNode(nodeId, patch);
    return ok({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const nodeId = parseId(id, "节点");
    const node = getNodeRow(nodeId);
    if (!node) throw new ApiFail("节点不存在", 404);

    const line = getLineRow(node.lineId);
    if (!line) throw new ApiFail("线路不存在", 404);

    const lines = listLineRowsByWork(line.workId);
    const allNodes = listNodeRowsByWork(line.workId);
    const status = workStatusOf(lines, allNodes);
    if (status === "done") {
      throw new ApiFail("工作已结束，先撤销结束再删除节点");
    }

    const body = await readBody(req);
    const downstream = body.downstream === true;
    const branches = body.branches === "cascade" ? "cascade" : "keep";
    try {
      const result = deleteNodes(nodeId, { downstream, branches });
      return ok({ ok: true, data: result });
    } catch (e) {
      throw new ApiFail(e instanceof Error ? e.message : "删除失败");
    }
  });
}
