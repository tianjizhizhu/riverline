import type { Difficulty } from "./types";

export type DifficultyMeta = {
  value: Difficulty;
  label: string;
  short: string;
  hint: string;
  /** 进入「快要到期」预警的提前天数 */
  warnDays: number;
  chip: string;
  dot: string;
};

export const DIFFICULTIES: DifficultyMeta[] = [
  {
    value: "water",
    label: "白开水任务",
    short: "白开水",
    hint: "顺手就能做完的小事",
    warnDays: 7,
    chip: "border-zinc-200 bg-zinc-50 text-zinc-500",
    dot: "bg-zinc-300",
  },
  {
    value: "sparkling",
    label: "气泡水任务",
    short: "气泡水",
    hint: "要动点脑子，需要集中一会儿",
    warnDays: 14,
    chip: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-400",
  },
  {
    value: "soda",
    label: "碳酸饮料任务",
    short: "碳酸饮料",
    hint: "硬仗，要留出整块时间",
    warnDays: 30,
    chip: "border-emerald-700 bg-emerald-700 text-white",
    dot: "bg-emerald-700",
  },
];

export function difficultyMeta(value: Difficulty): DifficultyMeta {
  return DIFFICULTIES.find((d) => d.value === value) ?? DIFFICULTIES[0];
}
