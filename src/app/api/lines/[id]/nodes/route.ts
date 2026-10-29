import { appendNode, listLineRowsByWork, listNodeRowsByWork } from "@/lib/db";
import { lineAcceptsProgress, workStatusOf } from "@/lib/derive";
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

    if (line.status !== "active") {
      throw new ApiFail("该线路已关闭或已汇合，无法继续记录进展");
    }
    if (!lineAcceptsProgress(line, nodes, status)) {
      throw new ApiFail("此线已结束，无法继续记录进展");
    }

    const body = await readBody(req);
    const date = body.date ? cleanDate(body.date, "日期") : today();
    const note = cleanText(body.note, "进展", 200);
    const nextTask = cleanText(body.nextTask, "下一步任务", 200);
    if (!note && !nextTask) throw new ApiFail("进展与下一步任务至少填写一项");

    const node = appendNode({
      lineId,
      type: "progress",
      date,
      note,
      nextTask,
    });
    return ok({ node });
  });
}
