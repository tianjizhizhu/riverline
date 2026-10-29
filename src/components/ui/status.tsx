import { cn } from "@/lib/cn";
import { difficultyMeta } from "@/lib/difficulty";
import type { Difficulty, LineStatus, NodeType, WorkStatus } from "@/lib/types";

const DOT: Record<WorkStatus | LineStatus, string> = {
  active: "bg-emerald-500",
  done: "bg-zinc-300",
  closed: "bg-zinc-300",
  completed: "bg-emerald-700",
  merged: "bg-sky-500",
};

export function StatusDot({
  status,
  breathe,
  className,
}: {
  status: WorkStatus | LineStatus;
  breathe?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        DOT[status],
        breathe && status === "active" && "animate-breathe",
        className,
      )}
    />
  );
}

const WORK_PILL: Record<WorkStatus, { label: string; cls: string }> = {
  active: {
    label: "进行中",
    cls: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  },
  done: { label: "已完成", cls: "border-zinc-200 bg-zinc-100 text-zinc-500" },
};

export function WorkStatusPill({ status }: { status: WorkStatus }) {
  const meta = WORK_PILL[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.cls,
      )}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}

export const LINE_STATUS: Record<LineStatus, { label: string; cls: string }> = {
  active: { label: "进行中", cls: "text-emerald-700" },
  closed: { label: "已关闭", cls: "text-zinc-400" },
  completed: { label: "已完成", cls: "text-emerald-700" },
  merged: { label: "已汇合", cls: "text-sky-600" },
};

const NODE_TAG: Record<NodeType, { label: string; cls: string }> = {
  start: { label: "起点", cls: "bg-zinc-100 text-zinc-500" },
  progress: { label: "进展", cls: "bg-emerald-50 text-emerald-700" },
  merge: { label: "汇合", cls: "bg-sky-50 text-sky-700" },
};

export function NodeTag({ type }: { type: NodeType }) {
  const meta = NODE_TAG[type];
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        meta.cls,
      )}
    >
      {meta.label}
    </span>
  );
}

export function DifficultyChip({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  const meta = difficultyMeta(difficulty);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.chip,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
