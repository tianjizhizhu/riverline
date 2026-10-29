import { getNodeRow, insertNodeAfter } from "@/lib/db";
import { ApiFail, ok, parseId, route } from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const nodeId = parseId(id, "节点");
    const node = getNodeRow(nodeId);
    if (!node) throw new ApiFail("节点不存在", 404);
    const created = insertNodeAfter(nodeId);
    return ok({ ok: true, data: created });
  });
}
