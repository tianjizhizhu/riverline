import { BoardPage } from "@/components/board/board-page";
import { listCategories } from "@/lib/db";
import { buildWorkSummaries } from "@/lib/summary";

export const instant = false;

export default async function Home() {
  return (
    <BoardPage initial={buildWorkSummaries()} categories={listCategories()} />
  );
}
