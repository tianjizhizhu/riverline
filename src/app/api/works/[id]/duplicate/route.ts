import { duplicateBlueprint, getWorkRow } from "@/lib/db";
import { ApiFail, cleanText, ok, parseId, readBody, route } from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const blueprintId = parseId(id, "蓝图");
    const bp = getWorkRow(blueprintId);
    if (!bp) throw new ApiFail("蓝图不存在", 404);
    if (bp.mode !== "blueprint") throw new ApiFail("只有蓝图可以复制");

    const body = await readBody(req);
    const title = cleanText(body.title, "蓝图名称", 50, true);
    const newId = duplicateBlueprint(blueprintId, title);
    return ok({ ok: true, data: { id: newId } });
  });
}
