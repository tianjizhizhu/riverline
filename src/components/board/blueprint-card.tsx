"use client";

import { motion } from "framer-motion";
import { ArrowRight, Copy, GitBranch } from "@phosphor-icons/react";
import Link from "next/link";
import { difficultyMeta } from "@/lib/difficulty";
import { cn } from "@/lib/cn";
import type { BlueprintSummary, Work } from "@/lib/types";

/** 蓝图管理页卡片：完成状态跟随其记录任务 */
export function BlueprintCard({
  summary,
  index,
  today,
  onCopy,
}: {
  summary: BlueprintSummary;
  index: number;
  today: string | null;
  onCopy: (work: Work) => void;
}) {
  const { work, spawned } = summary;
  const meta = difficultyMeta(work.difficulty);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: Math.min(index * 0.04, 0.3) }}
      className={cn(
        "group flex flex-col rounded-2xl border bg-white p-4 text-left transition",
        "border-zinc-200/80 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md hover:shadow-zinc-900/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-zinc-300">
            <GitBranch size={12} weight="bold" />
          </span>
          <span className="truncate font-mono text-[10.5px] tabular-nums text-zinc-400">
            {work.startDate} 创建
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onCopy(work)}
            aria-label="复制蓝图"
            title="复制这份蓝图，套用到新的研究上"
            className="rounded-md p-1 text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600 active:scale-95 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <Copy size={13} />
          </button>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
            summary.status === "done"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700",
          )}
        >
          {summary.status === "done"
            ? "已完成"
            : spawned
              ? "进行中 · 已生成记录"
              : "进行中 · 规划中"}
        </span>
        </div>
      </div>

      <Link href={`/work/${work.id}`} className="mt-2 block min-w-0">
        <h3 className="text-[14px] font-semibold leading-5 text-zinc-900 transition group-hover:text-zinc-700">
          {work.title}
        </h3>
      </Link>
      {work.goal && (
        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-500">{work.goal}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1">
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
        <span className="tabular-nums">{summary.nodeCount} 节点</span>
        {summary.branchTotal > 0 && (
          <span className="flex items-center gap-0.5 tabular-nums">
            <GitBranch size={10} weight="bold" />
            {summary.branchTotal} 分支
          </span>
        )}
        {work.dueDate && (
          <span
            className={cn(
              "tabular-nums",
              today && work.dueDate < today ? "text-rose-500" : "text-zinc-400",
            )}
          >
            目标 {work.dueDate}
          </span>
        )}
      </div>

      {spawned && (
        <Link
          href={`/work/${spawned.id}`}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-2 text-[11.5px] text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <span className="truncate">记录任务</span>
          <span className="ml-auto flex shrink-0 items-center gap-0.5 font-medium text-zinc-500">
            打开
            <ArrowRight size={11} weight="bold" />
          </span>
        </Link>
      )}
    </motion.div>
  );
}
