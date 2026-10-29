"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GitBranch, Warning } from "@phosphor-icons/react";
import { DifficultyChip, StatusDot } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { todayStr } from "@/lib/date";
import { difficultyMeta } from "@/lib/difficulty";
import type { Difficulty, WorkSummary } from "@/lib/types";

function dueTone(due: string | null, difficulty: Difficulty, today: string | null) {
  if (!due) return { text: "未设目标", cls: "text-zinc-300", suffix: "" };
  if (!today) return { text: due, cls: "text-zinc-400", suffix: "" };
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
  if (days < 0)
    return { text: due, cls: "font-medium text-red-600", suffix: `已逾期 ${-days} 天` };
  // 三级预警：正常不提示，进入各分级的提前天数算「快要到期」
  if (days <= difficultyMeta(difficulty).warnDays) {
    return {
      text: due,
      cls: "font-medium text-amber-600",
      suffix: days === 0 ? "今天到期" : `剩 ${days} 天`,
    };
  }
  return { text: due, cls: "text-zinc-400", suffix: "" };
}

/** 停滞预警阈值：超过 3 天没有动静即预警 */
const STAGNANT_DAYS = 3;

/**
 * 停滞天数：以全部线路最近一次写入节点的时间为准（主线、支线一视同仁，
 * 兜底为工作创建时间）。今天日期挂载后才就绪，未就绪不预警。
 */
function stagnantDaysOf(lastActivityAt: string, today: string | null): number | null {
  if (!today) return null;
  const days = Math.round(
    (Date.parse(today) - Date.parse(lastActivityAt.slice(0, 10))) / 86400000,
  );
  return days > STAGNANT_DAYS ? days : null;
}

export function WorkCard({
  summary,
  index,
}: {
  summary: WorkSummary;
  index: number;
}) {
  const {
    work,
    status,
    categoryName,
    currentTask,
    currentIsEnd,
    branchTotal,
    branchActive,
    nodeCount,
    lastActivityAt,
  } = summary;

  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayStr()), []);
  const due = dueTone(work.dueDate, work.difficulty, today);
  // 已完成的任务不再预警停滞
  const stagnant = status === "done" ? null : stagnantDaysOf(lastActivityAt, today);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        type: "spring",
        stiffness: 320,
        damping: 30,
        delay: Math.min(index * 0.035, 0.25),
      }}
      className="h-full"
    >
      <Link
        href={`/work/${work.id}`}
        className="group block h-full rounded-2xl border border-zinc-200/70 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-950/[0.04] active:scale-[0.985]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[10.5px] font-medium tracking-wide text-zinc-400">
            {categoryName ?? "未分类"}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {stagnant != null && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                title={`已 ${stagnant} 天没有动静：主线与支线均无新记录`}
              >
                <Warning size={11} weight="fill" />
                停滞预警
                <span className="font-normal tabular-nums">{stagnant} 天</span>
              </span>
            )}
            <DifficultyChip difficulty={work.difficulty} />
          </span>
        </div>

        <div className="mt-1.5 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 transition-colors group-hover:text-emerald-800">
            {work.title}
          </h3>
          <StatusDot status={status} breathe className="mt-1.5" />
        </div>

        {work.goal && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-zinc-500">
            {work.goal}
          </p>
        )}

        <div
          className={cn(
            "mt-3 rounded-r-lg border-l-2 px-2.5 py-1.5",
            currentIsEnd
              ? "border-zinc-300 bg-zinc-50"
              : "border-emerald-600/70 bg-emerald-50/60",
          )}
        >
          <p
            className={cn(
              "text-[10px] font-medium",
              currentIsEnd ? "text-zinc-400" : "text-emerald-800/50",
            )}
          >
            当前任务
          </p>
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-xs leading-5",
              currentIsEnd ? "text-zinc-400" : "text-emerald-900/80",
            )}
          >
            {currentIsEnd ? "主线已结束" : currentTask || "尚未记录进展"}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className={cn("font-mono tabular-nums", due.cls)}>
            {due.text}
            {due.suffix && (
              <span className="ml-1.5 font-sans text-[10px]">{due.suffix}</span>
            )}
          </span>
          <span className="flex items-center gap-2.5">
            {branchTotal > 0 && (
              <span className="inline-flex items-center gap-1">
                <GitBranch size={12} />
                {branchActive > 0
                  ? `分支 ${branchActive}/${branchTotal}`
                  : `分支 ${branchTotal}`}
              </span>
            )}
            <span className="tabular-nums">{nodeCount} 节点</span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
