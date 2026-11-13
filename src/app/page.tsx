import { connection } from "next/server";
import { BoardPage } from "@/components/board/board-page";
import { listCategories } from "@/lib/db";
import { buildWorkSummaries } from "@/lib/summary";

export const instant = false;

export default async function Home() {
  // 开启 cacheComponents 后静态预渲染会冻结看板数据，这里显式声明运行时渲染
  await connection();
  return (
    <BoardPage initial={buildWorkSummaries()} categories={listCategories()} />
  );
}
