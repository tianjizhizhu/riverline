import { getWorkRow, spawnWorkFromBlueprint } from "@/lib/db";
import { ApiFail, ok, parseId, route } from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

/** 蓝图孵化为记录任务：带入主线开始节点，与蓝图建立一对一关联。 */
export async function POST(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const blueprintId = parseId(id, "蓝图");
    const work = getWorkRow(blueprintId);
    if (!work) throw new ApiFail("蓝图不存在", 404);
    if (work.mode !== "blueprint") throw new ApiFail("只有蓝图可以生成记录");

    const workId = spawnWorkFromBlueprint(blueprintId);
    return ok({ id: workId });
  });
}
