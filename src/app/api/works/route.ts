import { createWork } from "@/lib/db";
import {
  cleanCategoryId,
  cleanDate,
  cleanDifficulty,
  cleanText,
  cleanWorkMode,
  ok,
  readBody,
  route,
} from "@/lib/api-server";
import { buildWorkSummaries } from "@/lib/summary";

export async function GET() {
  return route(async () => ok(buildWorkSummaries()));
}

export async function POST(req: Request) {
  return route(async () => {
    const body = await readBody(req);
    const title = cleanText(body.title, "工作名称", 50, true);
    const goal = cleanText(body.goal, "目标", 500, true);
    const startDate = cleanDate(body.startDate, "开始日期");
    const dueDate = body.dueDate ? cleanDate(body.dueDate, "目标日期") : null;
    const firstTask = cleanText(body.firstTask, "下一步任务", 200, true);
    const categoryId = cleanCategoryId(body.categoryId);
    const difficulty = cleanDifficulty(body.difficulty, "water");
    const mode = cleanWorkMode(body.mode);
    // 交付对象非必填：未填存空串
    const deliverTo = cleanText(body.deliverTo, "交付对象", 50);
    const id = createWork({
      title,
      goal,
      startDate,
      dueDate,
      categoryId,
      difficulty,
      firstTask,
      mode,
      deliverTo,
    });
    return ok({ id });
  });
}
