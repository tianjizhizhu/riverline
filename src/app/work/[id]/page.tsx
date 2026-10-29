import { notFound } from "next/navigation";
import { WorkDetail } from "@/components/work/work-detail";
import {
  getBlueprintWithSpawn,
  getWorkRow,
  listCategories,
  listLineRowsByWork,
  listMergeRowsByWork,
  listNodeRowsByWork,
} from "@/lib/db";

export const instant = false;

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workId = Number(id);
  const work = Number.isInteger(workId) ? getWorkRow(workId) : null;
  if (!work) notFound();

  const bp =
    work.blueprintId != null ? getBlueprintWithSpawn(work.blueprintId) : null;

  return (
    <WorkDetail
      work={work}
      lines={listLineRowsByWork(workId)}
      nodes={listNodeRowsByWork(workId)}
      merges={listMergeRowsByWork(workId)}
      categories={listCategories()}
      // 记录任务指向其蓝图；蓝图自身指向它孵化的记录任务
      blueprint={bp ? { ...bp, lines: listLineRowsByWork(bp.blueprint.id), nodes: listNodeRowsByWork(bp.blueprint.id) } : null}
      spawned={
        work.mode === "blueprint"
          ? getBlueprintWithSpawn(work.id)?.spawned ?? null
          : null
      }
    />
  );
}
