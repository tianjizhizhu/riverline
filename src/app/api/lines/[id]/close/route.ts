import { closeLine } from "@/lib/db";
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

    if (line.kind !== "branch") throw new ApiFail("主线不能关闭");
    if (line.status !== "active") throw new ApiFail("该分支已关闭或已汇合");

    const body = await readBody(req);
    const note = cleanText(body.note, "关闭说明", 200, true);
    closeLine(lineId, note);
    return ok({ ok: true });
  });
}
