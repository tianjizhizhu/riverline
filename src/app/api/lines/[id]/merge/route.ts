import {
  listLineRowsByWork,
  listNodeRowsByWork,
  mergeBranchIntoNode,
} from "@/lib/db";
import { mergeTargets } from "@/lib/derive";
import {
  ApiFail,
  cleanText,
  loadLineWithNodes,
  ok,
  parseId,
  readBody,
  route,
} from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const lineId = parseId(id, "线路");
    const { line } = loadLineWithNodes(lineId);

    if (line.kind !== "branch") throw new ApiFail("主线不能汇合");
    if (line.status !== "active") throw new ApiFail("只有进行中的分支可以汇合");

    const main = listLineRowsByWork(line.workId).find((l) => l.kind === "main");
    if (!main) throw new ApiFail("主线不存在", 500);

    const body = await readBody(req);
    const note = cleanText(body.note, "汇合说明", 200);
    const nodeId = Number(body.nodeId);
    if (!Number.isInteger(nodeId) || nodeId <= 0) {
      throw new ApiFail("请选择主线上的汇合节点");
    }

    const allNodes = listNodeRowsByWork(line.workId);
    const target = allNodes.find((n) => n.id === nodeId && n.lineId === main.id);
    if (!target) throw new ApiFail("汇合节点必须位于主线上");
    const allowed = mergeTargets(listLineRowsByWork(line.workId), allNodes, line);
    if (!allowed.some((n) => n.id === nodeId)) {
      throw new ApiFail("该节点不能作为汇合点，请选择主线上的一个进展节点");
    }

    mergeBranchIntoNode(lineId, nodeId, note);
    return ok({ ok: true });
  });
}
