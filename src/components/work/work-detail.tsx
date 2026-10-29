"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowUUpLeft,
  Blueprint as BlueprintIcon,
  CheckCircle,
  Copy,
  GitFork,
  GitMerge,
  PencilSimple,
  Plus,
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import { SiteHeader } from "@/components/site-header";
import { Btn } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  LINE_STATUS,
  DifficultyChip,
  NodeTag,
  StatusDot,
  WorkStatusPill,
} from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { LineMap } from "@/components/work/line-map";
import { BlueprintViewer } from "@/components/work/blueprint-viewer";
import { ApiError, api, del, postJson } from "@/lib/api";
import { categoryPath } from "@/lib/category";
import { cn } from "@/lib/cn";
import {
  lineAcceptsFork,
  lineAcceptsProgress,
  mergeTargets,
  workStatusOf,
} from "@/lib/derive";
import type {
  Category,
  Line,
  MergeRow,
  NodeRow,
  Work,
  WorkSnapshot,
  WorkStatus,
} from "@/lib/types";
import {
  CloseDialog,
  CompleteDialog,
  CopyBlueprintDialog,
  DeleteNodeDialog,
  EditNodeDialog,
  EditWorkDialog,
  ForkDialog,
  MergeDialog,
  ProgressDialog,
  UndoEndDialog,
} from "./dialogs";

type DialogState =
  | { kind: "progress" }
  | { kind: "fork"; nodeId: number }
  | { kind: "editNode"; nodeId: number }
  | { kind: "undo"; nodeId: number }
  | { kind: "merge" }
  | { kind: "complete" }
  | { kind: "close" }
  | { kind: "unmerge" }
  | { kind: "editWork" }
  | { kind: "spawn" }
  | { kind: "delete" }
  | { kind: "deleteNode"; nodeId: number }
  | { kind: "copyBlueprint" }
  | null;

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : "操作失败，请稍后再试";
}

const DOT_BY_TYPE: Record<NodeRow["type"], string> = {
  start: "bg-emerald-600",
  progress: "bg-zinc-300",
  merge: "bg-sky-500",
};

function NodeItem({
  node,
  index,
  line,
  status,
  branches,
  onEdit,
  onFork,
  onInsert,
  onDelete,
  onViewLine,
}: {
  node: NodeRow;
  index: number;
  line: Line;
  status: WorkStatus;
  branches: Line[];
  onEdit: (node: NodeRow) => void;
  onFork: (node: NodeRow) => void;
  onInsert: (node: NodeRow) => void;
  onDelete: (node: NodeRow) => void;
  onViewLine: (lineId: number) => void;
}) {
  const canFork = lineAcceptsFork(line, node, status);
  const editable = status !== "done";
  const sources = node.mergedBranchIds
    .map((id) => branches.find((b) => b.id === id))
    .filter((b): b is Line => !!b);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.24) }}
      className="relative pl-8 pb-6 last:pb-0 before:absolute before:left-[7px] before:top-5 before:h-[calc(100%-1.25rem)] before:w-px before:bg-zinc-200 last:before:hidden"
    >
      <span
        className={cn(
          "absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full ring-2 ring-white",
          DOT_BY_TYPE[node.type],
        )}
      />

      <div className="group/node -mx-2 rounded-xl px-2 transition-colors hover:bg-zinc-50/80">
      <div className="flex flex-wrap items-center gap-2">
        <NodeTag type={node.type} />
        <span className="font-mono text-[11px] text-zinc-400">{node.date}</span>
        {sources.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onViewLine(s.id)}
            className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700 transition hover:bg-sky-100"
          >
            <GitMerge size={11} weight="bold" />
            来自「{s.name}」
          </button>
        ))}
        {editable && (
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onInsert(node)}
              aria-label="在此之后插入节点"
              title="在此之后插入节点"
              className="rounded-md p-1 text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600 active:scale-95 md:opacity-0 md:group-hover/node:opacity-100 md:focus-visible:opacity-100"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(node)}
              aria-label="删除节点"
              title="删除节点"
              className="rounded-md p-1 text-zinc-300 transition hover:bg-red-50 hover:text-red-600 active:scale-95 md:opacity-0 md:group-hover/node:opacity-100 md:focus-visible:opacity-100"
            >
              <Trash size={13} />
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              aria-label="编辑节点"
              className="rounded-md p-1 text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600 active:scale-95 md:opacity-0 md:group-hover/node:opacity-100 md:focus-visible:opacity-100"
            >
              <PencilSimple size={13} />
            </button>
          </div>
        )}
      </div>

      {node.note && (
        <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-6 text-zinc-700">
          {node.note}
        </p>
      )}

      <div
        className={cn(
          "mt-2 flex items-start justify-between gap-3 rounded-r-lg border-l-2 px-3 py-2",
          node.nextTask
            ? "border-emerald-600/70 bg-emerald-50/60"
            : "border-zinc-200 bg-zinc-50",
        )}
      >
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium text-zinc-400">下一步</p>
          <p
            className={cn(
              "mt-0.5 text-[13px] leading-5",
              node.nextTask ? "text-emerald-900/90" : "text-zinc-400",
            )}
          >
            {node.nextTask || "此线在此结束"}
          </p>
        </div>
        {canFork && (
          <button
            type="button"
            onClick={() => onFork(node)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-600/20 bg-white/70 px-1.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:border-emerald-600/40 hover:bg-white active:scale-95 md:opacity-0 md:group-hover/node:opacity-100 md:focus-visible:opacity-100"
          >
            <GitFork size={12} weight="bold" />
            Fork
          </button>
        )}
      </div>
      </div>
    </motion.li>
  );
}

export function WorkDetail({
  work,
  lines,
  nodes,
  merges = [],
  categories,
  blueprint = null,
  spawned = null,
}: {
  work: Work;
  lines: Line[];
  nodes: NodeRow[];
  /** 全部汇合记录，供撤销快照完整还原 */
  merges?: MergeRow[];
  categories: Category[];
  /** 记录任务的规划原稿；非蓝图孵化的记录任务为 null */
  blueprint?: {
    blueprint: Work;
    spawned: Work | null;
    lines: Line[];
    nodes: NodeRow[];
  } | null;
  /** 蓝图孵化的记录任务；未孵化的蓝图为 null */
  spawned?: Work | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number>(lines[0]?.id ?? 0);
  // 支线视图（实验性）：脉络图中聚焦的支线，null 表示完整脉络
  const [viewLineId, setViewLineId] = useState<number | null>(null);
  const [dlg, setDlg] = useState<DialogState>(null);
  const [bpViewer, setBpViewer] = useState(false);
  const [spawning, setSpawning] = useState(false);
  // 撤销/重做历史：past 存每步操作前的快照，future 存被撤销掉的状态，各至多 10 步
  const [past, setPast] = useState<WorkSnapshot[]>([]);
  const [future, setFuture] = useState<WorkSnapshot[]>([]);
  // 插入节点后待自动打开编辑对话框的新节点 id
  const [pendingEditId, setPendingEditId] = useState<number | null>(null);

  // 蓝图只是身份不同，编辑能力与记录任务完全一致
  const isBlueprint = work.mode === "blueprint";
  const blueprintSpawned = isBlueprint && spawned != null;

  // 切换线路即退出支线视图，避免图与列表所选线路不一致
  const switchLine = (id: number) => {
    setSelectedId(id);
    setViewLineId(null);
  };

  const status = useMemo(() => workStatusOf(lines, nodes), [lines, nodes]);
  const main = lines.find((l) => l.kind === "main") ?? lines[0];
  const selected = lines.find((l) => l.id === selectedId) ?? main;
  const branches = lines.filter((l) => l.kind === "branch");
  const lineNodes = useMemo(
    () => nodes.filter((n) => n.lineId === selected.id),
    [nodes, selected.id],
  );
  const tail = lineNodes[lineNodes.length - 1] ?? null;
  const done = status === "done";
  const categoryName = categoryPath(categories, work.categoryId);
  const targets = useMemo(
    () => (selected.kind === "branch" ? mergeTargets(lines, nodes, selected) : []),
    [lines, nodes, selected],
  );

  const mainNodes = useMemo(
    () => nodes.filter((n) => n.lineId === main.id),
    [nodes, main.id],
  );
  const mainTail = mainNodes[mainNodes.length - 1] ?? null;

  // 撤销/重做：整体快照当前工作（线路、节点、汇合保留原 id），服务端按 id 重建
  const HISTORY_LIMIT = 10;

  const takeSnapshot = useCallback(
    (): WorkSnapshot => ({
      work: {
        title: work.title,
        goal: work.goal,
        startDate: work.startDate,
        dueDate: work.dueDate,
        categoryId: work.categoryId,
        difficulty: work.difficulty,
        deliverTo: work.deliverTo,
      },
      lines: lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        name: l.name,
        status: l.status,
        parentLineId: l.parentLineId,
        forkNodeId: l.forkNodeId,
        closedNote: l.closedNote,
        closedAt: l.closedAt,
      })),
      nodes: nodes.map((n) => ({
        id: n.id,
        lineId: n.lineId,
        type: n.type,
        date: n.date,
        note: n.note,
        nextTask: n.nextTask,
        fromBranchId: n.fromBranchId,
        seq: n.seq,
      })),
      merges: merges.map((m) => ({ ...m })),
    }),
    [work, lines, nodes, merges],
  );

  const pushHistory = useCallback((snap: WorkSnapshot) => {
    setPast((p) => [...p, snap].slice(-HISTORY_LIMIT));
    setFuture([]);
  }, []);

  const undo = useCallback(async () => {
    if (past.length === 0) return;
    const snap = past[past.length - 1];
    const current = takeSnapshot();
    try {
      await api.restoreWork(work.id, snap);
      setPast((p) => p.slice(0, -1));
      setFuture((f) => [current, ...f].slice(0, HISTORY_LIMIT));
      toast("已撤销上一步");
      router.refresh();
    } catch (err) {
      toast(errText(err), "error");
    }
  }, [past, takeSnapshot, work.id, router, toast]);

  const redo = useCallback(async () => {
    if (future.length === 0) return;
    const snap = future[0];
    const current = takeSnapshot();
    try {
      await api.restoreWork(work.id, snap);
      setFuture((f) => f.slice(1));
      setPast((p) => [...p, current].slice(-HISTORY_LIMIT));
      toast("已重做");
      router.refresh();
    } catch (err) {
      toast(errText(err), "error");
    }
  }, [future, takeSnapshot, work.id, router, toast]);

  // Ctrl+Z 撤销，Ctrl+Shift+Z / Ctrl+Y 重做；输入框内不拦截
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      e.preventDefault();
      if (key === "y" || e.shiftKey) void redo();
      else void undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // 插入的节点经 router.refresh 进入 props 后，自动打开编辑对话框补全内容
  useEffect(() => {
    if (pendingEditId == null) return;
    if (nodes.some((n) => n.id === pendingEditId)) {
      setDlg({ kind: "editNode", nodeId: pendingEditId });
      setPendingEditId(null);
    }
  }, [pendingEditId, nodes]);

  // 对话框在 API 成功后、refresh 前调用，此时取到的仍是变更前状态
  const onDone = () => {
    pushHistory(takeSnapshot());
    setDlg(null);
    router.refresh();
  };

  const forkNode =
    dlg?.kind === "fork" ? nodes.find((n) => n.id === dlg.nodeId) ?? null : null;
  const editNode =
    dlg?.kind === "editNode"
      ? nodes.find((n) => n.id === dlg.nodeId) ?? null
      : null;
  const deleteTarget =
    dlg?.kind === "deleteNode" ? nodes.find((n) => n.id === dlg.nodeId) ?? null : null;
  const deleteTargetLine = deleteTarget
    ? lines.find((l) => l.id === deleteTarget.lineId) ?? null
    : null;

  // 复制成功后直接进入新蓝图继续编辑
  const onBlueprintCopied = (id: number) => {
    setDlg(null);
    router.push(`/work/${id}`);
    router.refresh();
  };

  const reopen = async () => {
    const snap = takeSnapshot();
    try {
      await postJson(`/api/lines/${selected.id}/reopen`);
      pushHistory(snap);
      toast("分支已重新打开");
      router.refresh();
    } catch (err) {
      toast(errText(err), "error");
    }
  };

  const unmerge = async () => {
    const snap = takeSnapshot();
    try {
      await postJson(`/api/lines/${selected.id}/unmerge`);
      pushHistory(snap);
      toast("已撤销汇合，分支回到进行中");
      setDlg(null);
      router.refresh();
    } catch (err) {
      toast(errText(err), "error");
      setDlg(null);
    }
  };

  // 在某节点之后插入空白节点，随后自动打开编辑对话框补全内容
  const insertAfter = async (node: NodeRow) => {
    const snap = takeSnapshot();
    try {
      const created = await api.insertNodeAfter(node.id);
      pushHistory(snap);
      setPendingEditId(created.id);
      router.refresh();
    } catch (err) {
      toast(errText(err), "error");
    }
  };

  const remove = async () => {
    try {
      await del(`/api/works/${work.id}`);
      toast("工作已删除");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast(errText(err), "error");
      setDlg(null);
    }
  };

  const spawn = async () => {
    setSpawning(true);
    try {
      const { id } = await postJson<{ id: number }>(`/api/works/${work.id}/spawn`, {});
      setDlg(null);
      toast("已生成记录任务");
      router.push(`/work/${id}`);
      router.refresh();
    } catch (err) {
      toast(errText(err), "error");
    } finally {
      setSpawning(false);
    }
  };

  const canProgress = lineAcceptsProgress(selected, lineNodes, status);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-6 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 transition hover:text-zinc-700"
        >
          <ArrowLeft size={13} weight="bold" />
          返回看板
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <WorkStatusPill status={status} />
              {isBlueprint && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-600">
                  <BlueprintIcon size={11} weight="bold" />
                  {blueprintSpawned ? "蓝图 · 已生成记录" : "蓝图 · 规划中"}
                </span>
              )}
              <DifficultyChip difficulty={work.difficulty} />
              {categoryName && (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                  {categoryName}
                </span>
              )}
              <span className="text-[11px] text-zinc-400">
                {branches.length > 0
                  ? `${branches.filter((b) => b.status === "active").length} 条分支进行中 · 共 ${branches.length} 条`
                  : "暂无分支"}
              </span>
            </div>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-zinc-900">
              {work.title}
            </h1>
            {blueprint && (
              <p className="mt-1.5 text-[12px] text-zinc-400">
                这项工作由蓝图生成，规划原稿见「打开蓝图」。
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="ghost"
              onClick={undo}
              disabled={past.length === 0}
              aria-label="撤销"
              title={past.length === 0 ? "暂无可撤销的操作" : `撤销（Ctrl+Z），可回退 ${past.length} 步`}
              className="px-2.5"
            >
              <ArrowCounterClockwise size={14} />
            </Btn>
            <Btn
              variant="ghost"
              onClick={redo}
              disabled={future.length === 0}
              aria-label="重做"
              title={future.length === 0 ? "暂无可重做的操作" : `重做（Ctrl+Shift+Z），可前进 ${future.length} 步`}
              className="px-2.5"
            >
              <ArrowClockwise size={14} />
            </Btn>
            {isBlueprint && (
              <Btn
                variant="ghost"
                onClick={() => setDlg({ kind: "copyBlueprint" })}
                title="复制这份蓝图，套用到新的研究上"
              >
                <Copy size={14} />
                复制蓝图
              </Btn>
            )}
            {isBlueprint && !blueprintSpawned && (
              <Btn onClick={() => setDlg({ kind: "spawn" })} loading={spawning}>
                <GitFork size={14} weight="bold" />
                生成记录
              </Btn>
            )}
            {isBlueprint && blueprintSpawned && spawned && (
              <Link
                href={`/work/${spawned.id}`}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-zinc-50 transition hover:bg-zinc-800 active:scale-[0.98]"
              >
                <BlueprintIcon size={14} weight="bold" />
                查看记录任务
              </Link>
            )}
            {blueprint && (
              <Btn variant="soft" onClick={() => setBpViewer(true)}>
                <BlueprintIcon size={14} weight="bold" />
                打开蓝图
              </Btn>
            )}
            <Btn
              onClick={() => setDlg({ kind: "progress" })}
              disabled={!canProgress}
              title={canProgress ? undefined : "该线路当前不可记录进展"}
            >
              <Plus size={14} weight="bold" />
              记录进展
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => setDlg({ kind: "editWork" })}
              disabled={done}
              title={done ? "工作已结束" : undefined}
            >
              <PencilSimple size={14} />
              编辑
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => setDlg({ kind: "delete" })}
              aria-label="删除工作"
              className="px-2.5"
            >
              <Trash size={14} />
            </Btn>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-wide text-zinc-400">
                目标
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-6 text-zinc-700">
                {work.goal}
              </p>
            </div>
            <dl className="flex shrink-0 gap-7 text-[12px]">
              <div>
                <dt className="text-zinc-400">开始</dt>
                <dd className="mt-0.5 font-mono text-zinc-600">
                  {work.startDate}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">目标日期</dt>
                <dd className="mt-0.5 font-mono text-zinc-600">
                  {work.dueDate ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-400">节点</dt>
                <dd className="mt-0.5 font-mono text-zinc-600">{nodes.length}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">交付对象</dt>
                <dd className="mt-0.5 max-w-[200px] break-words text-zinc-600">
                  {work.deliverTo || "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {done && mainTail && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3">
            <div className="flex items-center gap-2 text-[13px] text-emerald-900">
              <CheckCircle size={18} weight="fill" className="text-emerald-600" />
              这项工作已经结束，全部脉络保留在下方。
            </div>
            <Btn
              size="sm"
              variant="soft"
              onClick={() => setDlg({ kind: "undo", nodeId: mainTail.id })}
            >
              <ArrowCounterClockwise size={13} />
              撤销结束
            </Btn>
          </div>
        )}

        <div className="mt-7 hidden rounded-2xl border border-zinc-200/70 bg-white px-5 py-4 md:block">
          <LineMap
            lines={lines}
            nodes={nodes}
            selectedId={selected.id}
            onSelect={setSelectedId}
            focusLineId={viewLineId}
            onOpenLine={(id) => {
              setViewLineId(id);
              setSelectedId(id);
            }}
            onExitFocus={() => setViewLineId(null)}
          />
        </div>

        <div className="mt-7 md:hidden">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium tracking-wide text-zinc-400">
              线路
            </p>
            <p className="text-[11px] text-zinc-300">点击切换查看</p>
          </div>
          <div className="scroll-thin -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
            {lines.map((line) => {
              const active = line.id === selected.id;
              const count = nodes.filter((n) => n.lineId === line.id).length;
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => switchLine(line.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition active:scale-[0.97]",
                    active
                      ? "border-zinc-900 bg-zinc-900 text-zinc-50"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900",
                  )}
                >
                  <StatusDot status={line.status} breathe />
                  <span className="font-medium">{line.name}</span>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      active ? "text-zinc-400" : "text-zinc-400",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <motion.section
          key={selected.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 rounded-2xl border border-zinc-200/70 bg-white p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
                  {selected.name}
                </h2>
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    LINE_STATUS[selected.status].cls,
                  )}
                >
                  {LINE_STATUS[selected.status].label}
                </span>
                {viewLineId != null && (
              <Btn
                size="sm"
                variant="soft"
                onClick={() => setViewLineId(null)}
                title="退出支线视图，回到完整脉络"
              >
                <ArrowUUpLeft size={13} weight="bold" />
                返回完整脉络
              </Btn>
            )}
            {selected.kind === "branch" && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    分支
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-zinc-400">
                {selected.kind === "main"
                  ? `${lineNodes.length} 个节点 · 主线持续向下`
                  : `${lineNodes.length} 个节点${selected.status === "merged" ? " · 已汇入主线" : ""}`}
              </p>
            </div>

            {selected.kind === "branch" && (
              <div className="flex flex-wrap items-center gap-2">
                {selected.status === "active" && (
                  <>
                    <Btn
                      size="sm"
                      variant="soft"
                      onClick={() => setDlg({ kind: "merge" })}
                    >
                      <GitMerge size={13} weight="bold" />
                      汇合进主线
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => setDlg({ kind: "complete" })}
                    >
                      <CheckCircle size={13} weight="bold" />
                      完成分支
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => setDlg({ kind: "close" })}
                    >
                      <XCircle size={13} />
                      关闭分支
                    </Btn>
                  </>
                )}
                {(selected.status === "closed" ||
                  selected.status === "completed") && (
                  <Btn size="sm" variant="ghost" onClick={reopen}>
                    <ArrowCounterClockwise size={13} />
                    重新打开
                  </Btn>
                )}
                {selected.status === "merged" && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => setDlg({ kind: "unmerge" })}
                  >
                    <ArrowUUpLeft size={13} />
                    撤销汇合
                  </Btn>
                )}
              </div>
            )}
          </div>

          {selected.status === "closed" && selected.closedNote && (
            <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-[12px] leading-5 text-zinc-500">
              已关闭 · {selected.closedNote}
              {selected.closedAt ? ` · ${selected.closedAt}` : ""}
            </p>
          )}
          {selected.status === "completed" && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-800">
              已完成 · {selected.closedNote ?? "这条派生分支已做完"}
              {selected.closedAt ? ` · ${selected.closedAt}` : ""}
            </p>
          )}
          {selected.status === "merged" && (
            <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-[12px] leading-5 text-sky-700">
              已汇入主线{selected.closedNote ? ` · ${selected.closedNote}` : ""}
              ，本分支节点仍可继续编辑；也可撤销汇合，让分支回到进行中。
            </p>
          )}

          <ul className="mt-5">
            {lineNodes.map((node, i) => (
              <NodeItem
                key={node.id}
                node={node}
                index={i}
                line={selected}
                status={status}
                branches={branches}
                onEdit={(n) => setDlg({ kind: "editNode", nodeId: n.id })}
                onFork={(n) => setDlg({ kind: "fork", nodeId: n.id })}
                onInsert={(n) => void insertAfter(n)}
                onDelete={(n) => setDlg({ kind: "deleteNode", nodeId: n.id })}
                onViewLine={switchLine}
              />
            ))}
          </ul>

          {selected.kind === "main" && branches.length === 0 && !done && (
            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-zinc-400">
              <GitFork size={13} />
              出现并行事项时，点任意节点「下一步」右侧的 Fork。
            </p>
          )}
        </motion.section>
      </main>

      <ProgressDialog
        open={dlg?.kind === "progress"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        line={selected}
        tail={tail}
      />
      <ForkDialog
        open={dlg?.kind === "fork"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        line={selected}
        node={forkNode}
      />
      <MergeDialog
        open={dlg?.kind === "merge"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        line={selected}
        targets={targets}
      />
      <CompleteDialog
        open={dlg?.kind === "complete"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        line={selected}
      />
      <CloseDialog
        open={dlg?.kind === "close"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        line={selected}
      />
      <EditNodeDialog
        open={dlg?.kind === "editNode"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        node={editNode}
      />
      <EditWorkDialog
        open={dlg?.kind === "editWork"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        work={work}
        categories={categories}
      />
      <UndoEndDialog
        open={dlg?.kind === "undo"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        node={mainTail}
      />
      <ConfirmDialog
        open={dlg?.kind === "unmerge"}
        onClose={() => setDlg(null)}
        onConfirm={unmerge}
        title="撤销汇合"
        description="这条分支会离开汇合点、回到进行中，之后可以重新汇合。汇合点上若还有其他分支汇入，则仍保持为汇合点。"
        confirmLabel="撤销汇合"
      />
      <ConfirmDialog
        open={dlg?.kind === "spawn"}
        onClose={() => setDlg(null)}
        onConfirm={spawn}
        title="生成记录任务"
        description="将创建一个正常的记录任务，带入主线的开始节点，从这一步开始推进。记录任务会关联这份蓝图，可随时打开蓝图对照规划；蓝图后续修改不影响已生成的记录任务。"
        confirmLabel="生成记录"
      />
      <ConfirmDialog
        open={dlg?.kind === "delete"}
        onClose={() => setDlg(null)}
        onConfirm={remove}
        title="删除这项工作"
        description="工作、全部线路与节点都会被移除，且无法恢复。"
        confirmLabel="删除"
        danger
      />
      <DeleteNodeDialog
        open={dlg?.kind === "deleteNode"}
        onClose={() => setDlg(null)}
        onDone={onDone}
        node={deleteTarget}
        line={deleteTargetLine}
        lines={lines}
        nodes={nodes}
        status={status}
      />
      <CopyBlueprintDialog
        open={dlg?.kind === "copyBlueprint"}
        onClose={() => setDlg(null)}
        onCopied={onBlueprintCopied}
        work={isBlueprint ? work : null}
      />
      {blueprint && (
        <BlueprintViewer
          open={bpViewer}
          onClose={() => setBpViewer(false)}
          blueprint={blueprint.blueprint}
          lines={blueprint.lines}
          nodes={blueprint.nodes}
          categories={categories}
        />
      )}
    </div>
  );
}
