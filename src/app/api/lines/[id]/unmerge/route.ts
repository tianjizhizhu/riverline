import { unmergeBranch } from "@/lib/db";
import { ApiFail, loadLineWithNodes, ok, parseId, route } from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const lineId = parseId(id, "线路");
    const { line } = loadLineWithNodes(lineId);

    if (line.kind !== "branch") throw new ApiFail("主线没有汇合可撤销");
    if (line.status !== "merged") throw new ApiFail("只有已汇合的分支可以撤销汇合");

    unmergeBranch(lineId);
    return ok({ ok: true });
  });
}
