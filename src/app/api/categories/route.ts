import { createCategory, listCategories } from "@/lib/db";
import { ApiFail, cleanCategoryParentId, cleanText, ok, readBody, route } from "@/lib/api-server";

export async function GET() {
  return route(async () => ok(listCategories()));
}

export async function POST(req: Request) {
  return route(async () => {
    const body = await readBody(req);
    const name = cleanText(body.name, "分类名称", 20, true);
    const parentId = cleanCategoryParentId(body.parentId);
    try {
      const id = createCategory(name, parentId);
      return ok({ id });
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw new ApiFail("同一层级下已有同名分类");
      throw e;
    }
  });
}
