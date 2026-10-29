import { completeLine } from "@/lib/db";
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

    if (line.kind !== "branch") throw new ApiFail("主线不能标记完成");
    if (line.status !== "active") throw new ApiFail("该分支已关闭、已完成或已汇合");

    const body = await readBody(req);
    const note = cleanText(body.note, "完成说明", 200, true);
    completeLine(lineId, note);
    return ok({ ok: true });
  });
}
