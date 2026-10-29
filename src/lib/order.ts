import { difficultyMeta } from "./difficulty";
import type { Difficulty, WorkSummary } from "./types";

/** 任务紧要程度的优先级：碳酸饮料 > 气泡水 > 白开水 */
const DIFFICULTY_RANK: Record<Difficulty, number> = {
  soda: 3,
  sparkling: 2,
  water: 1,
};

/** 预警档位：0 已逾期，1 快要到期（各分级提前天数内），2 无预警；today 未就绪时全部按无预警处理 */
const warnRank = (s: WorkSummary, today: string | null): number => {
  const due = s.work.dueDate;
  if (!today || !due) return 2;
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
  if (days < 0) return 0;
  return days <= difficultyMeta(s.work.difficulty).warnDays ? 1 : 2;
};

/** 按更新顺序排列：哪个任务有进展就排到最前 */
export function sortByRecent(list: WorkSummary[]): WorkSummary[] {
  return [...list].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
}

/** 按紧急程度排列：先按预警档（已逾期 > 快要到期 > 无预警），再按分级，最后到期更近的在前 */
export function sortByUrgent(list: WorkSummary[], today: string | null): WorkSummary[] {
  return [...list].sort((a, b) => {
    const byWarn = warnRank(a, today) - warnRank(b, today);
    if (byWarn !== 0) return byWarn;
    const byDifficulty =
      DIFFICULTY_RANK[b.work.difficulty] - DIFFICULTY_RANK[a.work.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    const dueA = a.work.dueDate;
    const dueB = b.work.dueDate;
    // 未设目标日期的任务排在同级之后
    if (!dueA || !dueB) {
      if (dueA === dueB) return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
      return dueA ? -1 : 1;
    }
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
  });
}
