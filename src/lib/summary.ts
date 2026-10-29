import { listCategories, listLineRowsByWork, listNodeRowsByWork, listWorkRows } from "./db";
import { categoryPath } from "./category";
import { workStatusOf } from "./derive";
import type { WorkSummary } from "./types";

/** 汇总看板卡片所需的信息，服务端与 API 共用。蓝图只在蓝图管理页展示，不进上半区。 */
export function buildWorkSummaries(): WorkSummary[] {
  const categories = listCategories();

  return listWorkRows()
    .filter((work) => work.mode !== "blueprint")
    .map((work) => {
      const lines = listLineRowsByWork(work.id);
      const nodes = listNodeRowsByWork(work.id);
      const main = lines.find((l) => l.kind === "main");
      const mainNodes = main ? nodes.filter((n) => n.lineId === main.id) : [];
      const tail = mainNodes[mainNodes.length - 1];

      const branches = lines.filter((l) => l.kind === "branch");
      const lastActivityAt = nodes.reduce(
        (latest, nd) => (nd.createdAt > latest ? nd.createdAt : latest),
        work.createdAt,
      );

      return {
        work,
        status: workStatusOf(lines, nodes),
        categoryName: categoryPath(categories, work.categoryId),
        currentTask: tail?.nextTask ?? "",
        currentIsEnd: tail ? tail.nextTask === "" : false,
        branchTotal: branches.length,
        branchActive: branches.filter((b) => b.status === "active").length,
        nodeCount: nodes.length,
        lastActivityAt,
      };
    });
}
