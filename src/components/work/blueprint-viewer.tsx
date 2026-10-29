"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Blueprint as BlueprintIcon, GitBranch } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { NodeTag } from "@/components/ui/status";
import { LineMap } from "@/components/work/line-map";
import { cn } from "@/lib/cn";
import type { Category, Line, NodeRow, Work } from "@/lib/types";

/**
 * 「打开蓝图」模态弹窗：完整再现蓝图任务窗口（脉络图 + 全部节点）。
 * 蓝图可随时编辑，这里展示的是当前规划内容，用于记录任务推进时对照。
 */
export function BlueprintViewer({
  open,
  onClose,
  blueprint,
  lines,
  nodes,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  blueprint: Work;
  lines: Line[];
  nodes: NodeRow[];
  categories: Category[];
}) {
  const [selectedId, setSelectedId] = useState<number>(lines[0]?.id ?? 0);
  const main = lines.find((l) => l.kind === "main") ?? lines[0];
  const selected = lines.find((l) => l.id === selectedId) ?? main;
  const lineNodes = nodes.filter((n) => n.lineId === selected.id);
  const branches = lines.filter((l) => l.kind === "branch");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`蓝图 · ${blueprint.title}`}
      description="当前规划内容，可随时回到蓝图页调整。"
      size="xl"
      className="h-[60dvh]"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-[11.5px] text-zinc-500">
          <span className="flex items-center gap-1">
            <BlueprintIcon size={11} weight="bold" className="text-zinc-400" />
            规划中
          </span>
          <span className="font-mono tabular-nums">{blueprint.startDate} 创建</span>
          <span className="tabular-nums">{nodes.length} 节点</span>
          {branches.length > 0 && (
            <span className="flex items-center gap-0.5 tabular-nums">
              <GitBranch size={11} weight="bold" />
              {branches.length} 分支
            </span>
          )}
          {blueprint.dueDate && <span className="font-mono">目标 {blueprint.dueDate}</span>}
        </div>

        {blueprint.goal && (
          <div>
            <p className="text-[11px] font-medium tracking-wide text-zinc-400">目标</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-zinc-700">
              {blueprint.goal}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200/70 bg-white px-4 py-3">
          <LineMap
            lines={lines}
            nodes={nodes}
            selectedId={selected.id}
            onSelect={setSelectedId}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {lines.map((line) => {
            const active = line.id === selected.id;
            const count = nodes.filter((n) => n.lineId === line.id).length;
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => setSelectedId(line.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition active:scale-[0.97]",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-zinc-50"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300",
                )}
              >
                <BlueprintIcon size={11} weight="regular" />
                <span className="font-medium">{line.name}</span>
                <span className={cn("text-[10.5px] tabular-nums", active ? "text-zinc-400" : "text-zinc-400")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <ul className="space-y-2.5">
          {lineNodes.map((node) => (
            <li key={node.id} className="rounded-xl bg-zinc-50/80 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <NodeTag type={node.type} />
                <span className="font-mono text-[11px] text-zinc-400">{node.date}</span>
              </div>
              {node.note && (
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-zinc-700">
                  {node.note}
                </p>
              )}
              <div className="mt-2 rounded-lg bg-white px-2.5 py-1.5">
                <p className="text-[10.5px] font-medium text-zinc-400">下一步</p>
                <p
                  className={cn(
                    "mt-0.5 text-[12.5px] leading-5",
                    node.nextTask ? "text-emerald-900/90" : "text-zinc-400",
                  )}
                >
                  {node.nextTask || "此线在此结束"}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <p className="text-[11.5px] text-zinc-400">
            这里是当前规划排布，调整蓝图不会改动已生成的记录任务。
          </p>
          <Link
            href={`/work/${blueprint.id}`}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-zinc-600 transition hover:text-zinc-900"
          >
            蓝图详情
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
      </div>
    </Dialog>
  );
}
