import { reopenLine } from "@/lib/db";
import { ApiFail, loadLineWithNodes, ok, parseId, route } from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const lineId = parseId(id, "线路");
    const { line } = loadLineWithNodes(lineId);

    if (line.kind !== "branch") throw new ApiFail("主线无需重开");
    if (line.status !== "closed" && line.status !== "completed") {
      throw new ApiFail("只有已关闭或已完成的分支可以重开");
    }

    reopenLine(lineId);
    return ok({ ok: true });
  });
}
