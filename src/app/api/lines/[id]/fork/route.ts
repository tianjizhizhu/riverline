import { createBranch, listLineRowsByWork, listNodeRowsByWork } from "@/lib/db";
import { lineAcceptsFork, workStatusOf } from "@/lib/derive";
import {
  ApiFail,
  cleanDate,
  cleanText,
  loadLineWithNodes,
  ok,
  parseId,
  readBody,
  route,
  today,
} from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const lineId = parseId(id, "线路");
    const { line, nodes } = loadLineWithNodes(lineId);

    const lines = listLineRowsByWork(line.workId);
    const allNodes = listNodeRowsByWork(line.workId);
    const status = workStatusOf(lines, allNodes);

    const body = await readBody(req);
    const nodeId = Number(body.nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) throw new ApiFail("Fork 起点节点不存在", 404);

    if (line.status !== "active") {
      throw new ApiFail("该线路已关闭或已汇合，无法 Fork");
    }
    if (!lineAcceptsFork(line, node, status)) {
      throw new ApiFail("此节点没有下一步任务，无法 Fork");
    }

    const name = cleanText(body.name, "分支名称", 30, true);
    const date = body.date ? cleanDate(body.date, "日期") : today();
    const firstTask = cleanText(body.firstTask, "分支的下一步任务", 200, true);

    const branchId = createBranch({
      workId: line.workId,
      parentLineId: line.id,
      forkNodeId: node.id,
      name,
      date,
      firstTask,
    });
    return ok({ lineId: branchId });
  });
}
