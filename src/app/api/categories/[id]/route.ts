import { deleteCategory, getCategoryRow, hasChildCategory, renameCategory } from "@/lib/db";
import { ApiFail, cleanText, ok, parseId, readBody, route } from "@/lib/api-server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const categoryId = parseId(id, "分类");
    if (!getCategoryRow(categoryId)) throw new ApiFail("分类不存在", 404);

    const body = await readBody(req);
    const name = cleanText(body.name, "分类名称", 20, true);
    try {
      renameCategory(categoryId, name);
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw new ApiFail("同一层级下已有同名分类");
      throw e;
    }
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { id } = await ctx.params;
    const categoryId = parseId(id, "分类");
    if (!getCategoryRow(categoryId)) throw new ApiFail("分类不存在", 404);
    if (hasChildCategory(categoryId)) throw new ApiFail("请先删除其下的子分类");
    deleteCategory(categoryId);
    return ok({ ok: true });
  });
}
