"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { MotionConfig, motion } from "framer-motion";
import { ArrowLeft, Check, GitFork, GitMerge, X } from "@phosphor-icons/react";
import { LINE_STATUS, NodeTag, StatusDot } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import type { Line, LineStatus, NodeRow } from "@/lib/types";

const VIEW_W = 1080;
const CARD_W = 186;
const CARD_H = 100;
const NODE_GAP = CARD_W + 24;
const PAD_L = 104;
const PAD_R = 104;
const TOP_PAD = 16;
const PILL_H = 30;
const PILL_MIN = 168;
const PILL_MAX = 252;
const LANE_H = 42;
const LANE_GAP = 34;
const STEM = 26;

const clamp = (min: number, v: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** 粗略估算文本像素宽，用于决定支流药丸的宽度 */
const textW = (s: string) => {
  let w = 0;
  for (const ch of s) w += (ch.codePointAt(0) ?? 0) > 0x2e80 ? 12 : 6.8;
  return Math.round(w);
};

/** 折线转圆角路径：相邻两段之间以四分之一圆滑过渡 */
const roundedPolyline = (pts: Array<[number, number]>, radius = 10) => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    if (inLen === 0 || outLen === 0) continue;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ux = (x - px) / inLen;
    const uy = (y - py) / inLen;
    const vx = (nx - x) / outLen;
    const vy = (ny - y) / outLen;
    d += ` L ${x - ux * r} ${y - uy * r} Q ${x} ${y} ${x + vx * r} ${y + vy * r}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L ${lx} ${ly}`;
};

/** 分支离开主轴、升入药丸中心的圆角折线 */
const forkPath = (startX: number, mainY: number, inX: number, pillMidY: number) =>
  roundedPolyline(
    [
      [startX, mainY],
      [startX, (mainY + pillMidY) / 2],
      [inX, (mainY + pillMidY) / 2],
      [inX, pillMidY],
    ],
    9,
  );

/** 分支从药丸中心折回主轴汇合点：先横向走，再一个折角下行到汇合节点 */
const mergePath = (upX: number, pillMidY: number, mergeX: number, mainY: number) =>
  roundedPolyline(
    [
      [upX, pillMidY],
      [mergeX, pillMidY],
      [mergeX, mainY],
    ],
    9,
  );

type Lane = {
  line: Line;
  forkNode: NodeRow | undefined;
  startX: number;
  inX: number;
  mergeX: number | null;
  upX: number;
  laneY: number;
  pillW: number;
  pillLeft: number;
  nodes: NodeRow[];
};

/** 主线上的一个节点卡片 */
function NodeCard({
  node,
  lineId,
  x,
  top,
  index,
  active,
  forkCount,
  mergeFrom,
  context,
  contextLabel,
  onSelect,
}: {
  node: NodeRow;
  lineId: number;
  x: number;
  top: number;
  index: number;
  active: boolean;
  forkCount: number;
  /** 汇入该节点的分支名 */
  mergeFrom: string[];
  /** 支线视图中的上游上下文节点：弱化展示，点击返回完整脉络 */
  context?: boolean;
  /** 上下文节点来源标签，默认「主线」 */
  contextLabel?: string;
  onSelect: () => void;
}) {
  const ended = node.nextTask === "";
  return (
    <motion.div
      data-line={lineId}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 240,
        damping: 24,
        delay: Math.min(index * 0.045, 0.36),
      }}
      style={{
        position: "absolute",
        left: x - CARD_W / 2,
        top,
        width: CARD_W,
        height: CARD_H,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        title={context ? `${contextLabel ?? "主线"}节点 · 点击返回完整脉络` : undefined}
        className={cn(
          "group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white px-2.5 py-2 text-left transition duration-200",
          context
            ? "border-dashed border-zinc-300 opacity-60 hover:opacity-90"
            : active
              ? "border-emerald-300 shadow-md shadow-emerald-900/5 ring-1 ring-emerald-200/70"
              : "border-zinc-200/90 shadow-sm hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md hover:shadow-zinc-900/5",
        )}
      >
        <div className="flex items-center gap-1.5">
          <NodeTag type={node.type} />
          {context && (
            <span className="rounded bg-zinc-100 px-1 text-[9.5px] font-medium text-zinc-500">
              {contextLabel ?? "主线"}
            </span>
          )}
          <span className="font-mono text-[10.5px] tabular-nums text-zinc-400">
            {node.date}
          </span>
          <span className="ml-auto flex items-center gap-1">
            {mergeFrom.length > 0 && (
              <span
                title={
                  mergeFrom.length === 1
                    ? `汇合自「${mergeFrom[0]}」`
                    : `${mergeFrom.length} 条分支汇入：${mergeFrom.map((n) => `「${n}」`).join("、")}`
                }
                className="inline-flex h-4 items-center gap-0.5 rounded bg-sky-50 px-1 text-[10px] font-medium tabular-nums text-sky-600"
              >
                <GitMerge size={10} weight="bold" />
                {mergeFrom.length > 1 && mergeFrom.length}
              </span>
            )}
            {forkCount > 0 && (
              <span className="inline-flex h-4 items-center gap-0.5 rounded bg-zinc-100 px-1 text-[10px] font-medium tabular-nums text-zinc-500">
                <GitFork size={10} weight="bold" />
                {forkCount}
              </span>
            )}
          </span>
        </div>

        <p className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-[1.5] text-zinc-700">
          {node.note || "无备注"}
        </p>

        <div
          className={cn(
            "mt-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]",
            ended ? "bg-zinc-50 text-zinc-400" : "bg-emerald-50/70 text-emerald-800",
          )}
        >
          <span className="shrink-0 text-[9.5px] font-semibold tracking-wide opacity-70">
            {ended ? "结束" : "下一步"}
          </span>
          <span className="min-w-0 truncate">
            {ended ? "此线在此结束" : node.nextTask}
          </span>
        </div>
      </button>
    </motion.div>
  );
}

/** 支流轨道药丸 */
function BranchPill({
  lane,
  index,
  selected,
  onSelect,
  onOpenLine,
  onHover,
}: {
  lane: Lane;
  index: number;
  selected: boolean;
  onSelect: () => void;
  /** 双击：进入该支线的支线视图 */
  onOpenLine?: () => void;
  onHover: (nodeId: number | null) => void;
}) {
  const meta = LINE_STATUS[lane.line.status];
  const end =
    lane.line.status === "merged" ? (
      <GitMerge size={12} weight="bold" className="shrink-0 text-sky-500" />
    ) : lane.line.status === "completed" ? (
      <Check size={12} weight="bold" className="shrink-0 text-emerald-700" />
    ) : lane.line.status === "closed" ? (
      <X size={12} weight="bold" className="shrink-0 text-zinc-400" />
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: 0.08 + Math.min(index * 0.05, 0.3),
      }}
      style={{
        position: "absolute",
        left: lane.pillLeft,
        top: lane.laneY - PILL_H / 2,
        width: lane.pillW,
        height: PILL_H,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onOpenLine}
        onMouseEnter={() => onHover(lane.forkNode?.id ?? null)}
        onMouseLeave={() => onHover(null)}
        title={
          onOpenLine
            ? `${lane.line.name} · ${meta.label} · ${lane.nodes.length} 节点 · 单击切换 · 双击进入支线视图`
            : `${lane.line.name} · ${meta.label} · ${lane.nodes.length} 节点`
        }
        className={cn(
          "flex h-full w-full items-center gap-1.5 rounded-full border px-2.5 shadow-sm transition duration-200",
          selected
            ? "border-zinc-900 bg-zinc-900 text-zinc-50 shadow-md"
            : "border-zinc-200/90 bg-white text-zinc-600 hover:border-zinc-300 hover:shadow",
        )}
      >
        <StatusDot status={lane.line.status} breathe />
        <span className="min-w-0 truncate text-[12px] font-medium">
          {lane.line.name}
        </span>
        <span className="shrink-0 text-[10.5px] tabular-nums opacity-60">
          {lane.nodes.length}
        </span>
        <span
          className={cn(
            "shrink-0 text-[10.5px]",
            selected ? "text-zinc-400" : meta.cls,
          )}
        >
          {meta.label}
        </span>
        {end}
      </button>
    </motion.div>
  );
}

/**
 * 脉络图：主线是一条会呼吸的光带，节点是悬挂其下的卡片；
 * 支流是主线上方的药丸轨道，汇合的分支折回主线。
 * 点击任意线路可切换详情，可左右拖动平移；
 * 双击支流药丸进入支线视图：该支线成链展示，主线仅保留 Fork 与汇合节点作为上下文。
 */
export function LineMap({
  lines,
  nodes,
  selectedId,
  onSelect,
  focusLineId = null,
  onOpenLine,
  onExitFocus,
}: {
  lines: Line[];
  nodes: NodeRow[];
  selectedId: number;
  onSelect: (lineId: number) => void;
  /** 支线视图：聚焦的支线 id，该支线充当主轴 */
  focusLineId?: number | null;
  /** 双击支线药丸：进入支线视图 */
  onOpenLine?: (lineId: number) => void;
  /** 退出支线视图，返回完整脉络 */
  onExitFocus?: () => void;
}) {
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);

  // 渐变 id 按实例唯一：记录任务页与「打开蓝图」弹窗等场景会同时挂多个脉络图，
  // 若共用固定 id，url(#axisCore) 只会解析到文档第一处定义，
  // 另一张图的主轴会落到错误坐标系里，表现为主线只剩一小段甚至整体消失
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const axisCoreId = `axisCore-${uid}`;
  const axisGlowId = `axisGlow-${uid}`;

  const layout = useMemo(() => {
    const main = lines.find((l) => l.kind === "main");
    if (!main) return null;

    // 支线视图：目标支线充当主轴，其下分支照常显示为支流轨道；
    // 主线只保留 Fork 点与汇合点作为上下文节点，其余支线全部隐藏
    const focusTarget =
      focusLineId != null ? lines.find((l) => l.id === focusLineId) : undefined;
    const focused =
      focusTarget && focusTarget.kind === "branch" && focusTarget.id !== main.id
        ? focusTarget
        : null;
    const axisId = focused?.id ?? main.id;
    const viewLines: Line[] = focused
      ? [
          { ...focused, kind: "main" as const },
          ...lines.filter(
            (l) =>
              l.kind === "branch" &&
              nodes.some(
                (nd) => nd.id === l.forkNodeId && nd.lineId === focused.id,
              ),
          ),
          main,
        ]
      : lines;

    const mainNodes = nodes.filter((n) => n.lineId === axisId);
    const n = mainNodes.length;
    if (n === 0) return null;

    const before: NodeRow[] = [];
    const after: NodeRow[] = [];
    if (focused) {
      const fork = focused.forkNodeId
        ? nodes.find((nd) => nd.id === focused.forkNodeId)
        : undefined;
      const merge = nodes.find(
        (nd) => nd.lineId === main.id && nd.mergedBranchIds.includes(focused.id),
      );
      if (fork) before.push(fork);
      if (merge && merge.id !== fork?.id) after.push(merge);
    }
    const seq: NodeRow[] = [...before, ...mainNodes, ...after];
    const contextIds = new Set([...before, ...after].map((nd) => nd.id));

    // 节点间距固定，节点变多时画布横向变宽，由外层容器滚动，不压缩节点
    const chartW = Math.max(
      VIEW_W,
      PAD_L + PAD_R + Math.max(0, seq.length - 1) * NODE_GAP,
    );
    const span = chartW - PAD_L - PAD_R;
    const xOf = new Map<number, number>();
    seq.forEach((nd, i) => {
      xOf.set(
        nd.id,
        seq.length === 1 ? PAD_L + span / 2 : PAD_L + (i * span) / (seq.length - 1),
      );
    });

    const nodeById = new Map(nodes.map((nd) => [nd.id, nd]));
    const lineById = new Map(viewLines.map((l) => [l.id, l]));

    // 任意节点在主线上的投影 x：沿 fork 链向上走到主线
    const mainXOfNode = (nd: NodeRow | undefined): number => {
      let cur = nd;
      let guard = 0;
      while (cur && guard++ < 16) {
        const x = xOf.get(cur.id);
        if (x !== undefined) return x;
        const line = lineById.get(cur.lineId);
        cur = line?.forkNodeId ? nodeById.get(line.forkNodeId) : undefined;
      }
      return PAD_L + span / 2;
    };

    const branches = viewLines
      .filter((l) => l.kind === "branch")
      .sort((a, b) => {
        const an = a.forkNodeId ? nodeById.get(a.forkNodeId) : undefined;
        const bn = b.forkNodeId ? nodeById.get(b.forkNodeId) : undefined;
        return mainXOfNode(an) - mainXOfNode(bn) || a.id - b.id;
      });

    const lanes: Lane[] = branches.map((b, i) => {
      const forkNode = b.forkNodeId ? nodeById.get(b.forkNodeId) : undefined;
      const startX = mainXOfNode(forkNode);
      const mergeNode = nodes.find(
        (nd) => nd.mergedBranchIds.includes(b.id) && nd.lineId === axisId,
      );
      const mergeX = mergeNode ? (xOf.get(mergeNode.id) ?? startX) : null;
      // laneY 从药丸顶缘起算，避免最上方支流被画布裁切
      const laneY = TOP_PAD + PILL_H / 2 + i * LANE_H;
      const pillW = clamp(
        PILL_MIN,
        96 + textW(b.name) + 30,
        PILL_MAX,
      );
      const pillLeft = clamp(10, startX - pillW / 2, chartW - pillW - 10);
      const inX = clamp(pillLeft + 14, startX, pillLeft + pillW - 14);
      const upX =
        mergeX == null
          ? 0
          : mergeX < pillLeft + 14
            ? pillLeft + 12
            : mergeX > pillLeft + pillW - 14
              ? pillLeft + pillW - 12
              : mergeX;
      return {
        line: b,
        forkNode,
        startX,
        inX,
        mergeX,
        upX,
        laneY,
        pillW,
        pillLeft,
        nodes: nodes.filter((nd) => nd.lineId === b.id),
      };
    });

    const lastPillBottom = lanes.length
      ? TOP_PAD + PILL_H / 2 + (lanes.length - 1) * LANE_H + PILL_H / 2
      : 0;
    const mainY = lanes.length ? lastPillBottom + LANE_GAP : TOP_PAD + 26;
    const cardTop = mainY + STEM;
    const height = cardTop + CARD_H + 14;

    return {
      main: focused ?? main,
      originMainId: main.id,
      focused,
      mainNodes,
      contextIds,
      seq,
      xOf,
      lanes,
      mainY,
      cardTop,
      height,
      chartW,
      first: seq[0],
      last: seq[seq.length - 1],
    };
  }, [lines, nodes, focusLineId]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });
  const suppressClickUntil = useRef(0);
  const firstRun = useRef(true);

  // 按住左键横向拖动平移；拖动结束后吞掉随之而来的 click，避免误选线路
  const onPointerDown = (e: ReactPointerEvent) => {
    const el = scrollerRef.current;
    if (!el || e.pointerType === "touch" || e.button !== 0) return;
    if (el.scrollWidth <= el.clientWidth) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startLeft: el.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const el = scrollerRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) > 4) {
      drag.current.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    if (drag.current.moved) el.scrollLeft = drag.current.startLeft - dx;
  };

  const endDrag = (e: ReactPointerEvent) => {
    const el = scrollerRef.current;
    if (drag.current.active && drag.current.moved) {
      suppressClickUntil.current = Date.now() + 250;
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
    drag.current.active = false;
  };

  const onClickCapture = (e: ReactMouseEvent) => {
    if (Date.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // 切换线路时把对应元素滚到可视区中部
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const el = scrollerRef.current;
    if (!el) return;
    el
      .querySelector<HTMLElement>(`[data-line="${selectedId}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  if (!layout) return null;

  const {
    main,
    originMainId,
    focused,
    mainNodes,
    contextIds,
    seq,
    xOf,
    lanes,
    mainY,
    cardTop,
    height,
    chartW,
  } = layout;
  const mainSelected = main.id === selectedId;
  const mainOpen = layout.last.nextTask !== "";
  const forkCountOf = (id: number) =>
    lanes.filter((l) => l.forkNode?.id === id).length;

  // 主轴起止贴合首末节点：两端各外延 AX_TIP 作淡出 tip。
  // 渐变淡出区严格限定在外延段内（AX_FADE 由 AX_TIP 换算），
  // 首末节点本体保持在实色区，避免节点被吞进渐隐区导致主线「断」在半路
  const AX_TIP = 28;
  const AX_L = (xOf.get(seq[0]?.id ?? -1) ?? PAD_L) - AX_TIP;
  const AX_R = (xOf.get(seq[seq.length - 1]?.id ?? -1) ?? (chartW - PAD_R)) + AX_TIP;
  const AX_FADE = Math.min(AX_TIP / Math.max(AX_R - AX_L, 1), 0.45);

  const strokeOf = (status: LineStatus) =>
    status === "merged"
      ? "stroke-sky-400"
      : status === "closed"
        ? "stroke-zinc-300"
        : status === "completed"
          ? "stroke-emerald-700"
          : "stroke-emerald-500";

  const branchStatusCount = (status: LineStatus) =>
    lanes.filter((l) => l.line.status === status).length;

  return (
    <MotionConfig reducedMotion="user">
      <div>
        {/* 信息条 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
          <span className="font-medium tracking-wide text-zinc-500">脉络图</span>
          {focused ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-900 bg-zinc-900 px-2 py-0.5 font-medium text-zinc-50">
                支线视图 · {focused.name}
              </span>
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                支线 {mainNodes.length} 节点
              </span>
              <span className="font-mono tabular-nums text-zinc-400">
                {layout.first.date} → {layout.last.date}
              </span>
              {onExitFocus && (
                <button
                  type="button"
                  onClick={onExitFocus}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  <ArrowLeft size={11} weight="bold" />
                  返回完整脉络
                </button>
              )}
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                主线 {mainNodes.length} 节点
              </span>
              <span className="font-mono tabular-nums text-zinc-400">
                {layout.first.date} → {layout.last.date}
              </span>
            </>
          )}
          {lanes.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-zinc-400">{lanes.length} 条支流</span>
              {(["active", "merged", "completed", "closed"] as LineStatus[]).map(
                (k) => {
                  const c = branchStatusCount(k);
                  if (c === 0) return null;
                  return (
                    <span
                      key={k}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-500"
                    >
                      <StatusDot status={k} breathe />
                      {LINE_STATUS[k].label}
                      <span className="tabular-nums text-zinc-400">{c}</span>
                    </span>
                  );
                },
              )}
            </span>
          )}
          <span className="ml-auto text-zinc-300">
            {focused ? "拖动可平移" : "拖动可平移 · 单击切换 · 双击支线进入视图"}
          </span>
        </div>

        <div
          ref={scrollerRef}
          className="scroll-none mt-3 cursor-grab select-none overflow-x-auto overflow-y-hidden active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
        >
          <div className="relative" style={{ width: chartW, height }}>
            <svg
              width={chartW}
              height={height}
              viewBox={`0 0 ${chartW} ${height}`}
              className="absolute inset-0 block"
              role="img"
              aria-label="工作脉络图"
            >
              <defs>
                <linearGradient
                  id={axisCoreId}
                  gradientUnits="userSpaceOnUse"
                  x1={AX_L}
                  y1={0}
                  x2={AX_R}
                  y2={0}
                >
                  <stop offset="0" stopColor="#10b981" stopOpacity="0" />
                  <stop offset={AX_FADE} stopColor="#10b981" stopOpacity="0.95" />
                  <stop offset={1 - AX_FADE} stopColor="#10b981" stopOpacity="0.95" />
                  <stop offset="1" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id={axisGlowId}
                  gradientUnits="userSpaceOnUse"
                  x1={AX_L}
                  y1={0}
                  x2={AX_R}
                  y2={0}
                >
                  <stop offset="0" stopColor="#10b981" stopOpacity="0" />
                  <stop offset={AX_FADE} stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset={1 - AX_FADE} stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* 支流走线 */}
              {lanes.map((lane, i) => {
                const selected = lane.line.id === selectedId;
                const closed = lane.line.status === "closed";
                const stem = forkPath(lane.startX, mainY, lane.inX, lane.laneY);
                const back =
                  lane.mergeX == null
                    ? null
                    : mergePath(lane.upX, lane.laneY, lane.mergeX, mainY);
                const stemCls = cn(
                  strokeOf(lane.line.status),
                  selected && "stroke-zinc-400",
                );
                return (
                  <g
                    key={lane.line.id}
                    className="cursor-pointer"
                    onClick={() => onSelect(lane.line.id)}
                  >
                    <path
                      d={`${stem}${back ? ` ${back}` : ""}`}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={18}
                    />
                    {closed ? (
                      <>
                        <path
                          d={stem}
                          fill="none"
                          className={stemCls}
                          strokeWidth={selected ? 2.5 : 1.75}
                          strokeLinecap="round"
                          strokeDasharray="5 5"
                        />
                        {back && (
                          <path
                            d={back}
                            fill="none"
                            className="stroke-sky-300"
                            strokeWidth={selected ? 2.5 : 1.75}
                            strokeLinecap="round"
                            strokeDasharray="5 5"
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <motion.path
                          d={stem}
                          fill="none"
                          className={cn(
                            strokeOf(lane.line.status),
                            selected && "brightness-95",
                          )}
                          strokeWidth={selected ? 2.5 : 1.75}
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{
                            duration: 0.5,
                            delay: 0.12 + i * 0.06,
                            ease: "easeInOut",
                          }}
                        />
                        {back && (
                          <motion.path
                            d={back}
                            fill="none"
                            className="stroke-sky-400"
                            strokeWidth={selected ? 2.5 : 1.75}
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{
                              duration: 0.45,
                              delay: 0.24 + i * 0.06,
                              ease: "easeInOut",
                            }}
                          />
                        )}
                      </>
                    )}
                  </g>
                );
              })}

              {/* 主轴：发光带 + 核心线 + 流动光点 */}
              <g className="cursor-pointer" onClick={() => onSelect(main.id)}>
                <line
                  x1={AX_L}
                  y1={mainY}
                  x2={AX_R}
                  y2={mainY}
                  stroke="transparent"
                  strokeWidth={30}
                />
                <line
                  x1={AX_L}
                  y1={mainY}
                  x2={AX_R}
                  y2={mainY}
                  stroke={`url(#${axisGlowId})`}
                  strokeWidth={14}
                  strokeLinecap="round"
                  className="transition-opacity duration-300"
                  style={{ opacity: mainSelected ? 0.5 : 0.3 }}
                />
                <line
                  x1={AX_L}
                  y1={mainY}
                  x2={AX_R}
                  y2={mainY}
                  stroke={`url(#${axisCoreId})`}
                  strokeWidth={3}
                  strokeLinecap="round"
                  className="transition-opacity duration-300"
                  style={{ opacity: mainSelected ? 1 : 0.82 }}
                />
                <line
                  x1={AX_L}
                  y1={mainY}
                  x2={AX_R}
                  y2={mainY}
                  stroke="#ffffff"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="3 12"
                  className="map-flow"
                  style={{ opacity: mainSelected ? 0.95 : 0.7 }}
                />
                {mainOpen && (
                  <path
                    d={`M ${AX_R + 8} ${mainY - 5} l 5 5 l -5 5`}
                    fill="none"
                    className="stroke-emerald-500"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </g>

              {/* 节点挂茎 */}
              {seq.map((nd) => {
                const x = xOf.get(nd.id) ?? 0;
                const context = contextIds.has(nd.id);
                return (
                  <line
                    key={`stem-${nd.id}`}
                    x1={x}
                    y1={mainY + 7}
                    x2={x}
                    y2={cardTop - 3}
                    className={cn(
                      "transition-colors",
                      context
                        ? "stroke-zinc-200 [stroke-dasharray:3_3]"
                        : mainSelected
                          ? "stroke-emerald-200"
                          : "stroke-zinc-200",
                    )}
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* 支线视图：上下文节点与主轴节点之间的衔接虚线（Fork 侧与汇合侧双向） */}
              {seq.map((nd, i) => {
                const next = seq[i + 1];
                if (!next) return null;
                if (contextIds.has(nd.id) === contextIds.has(next.id)) return null;
                const x = xOf.get(nd.id) ?? 0;
                const nx = xOf.get(next.id) ?? 0;
                return (
                  <line
                    key={`ctx-${nd.id}`}
                    x1={x + CARD_W / 2}
                    y1={cardTop + CARD_H / 2}
                    x2={nx - CARD_W / 2}
                    y2={cardTop + CARD_H / 2}
                    className="stroke-zinc-300"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* 节点站台点 */}
              {seq.map((nd) => {
                const x = xOf.get(nd.id) ?? 0;
                const ended = nd.nextTask === "";
                const isLast = nd.id === mainNodes[mainNodes.length - 1]?.id;
                const dotCls = ended
                  ? "fill-zinc-300"
                  : nd.type === "start"
                    ? "fill-emerald-600"
                    : nd.type === "merge"
                      ? "fill-sky-500"
                      : "fill-white";
                const ringCls = ended
                  ? "stroke-white"
                  : nd.type === "progress"
                    ? "stroke-zinc-300"
                    : "stroke-white";
                return (
                  <g key={nd.id}>
                    {isLast && !ended && (
                      <circle
                        cx={x}
                        cy={mainY}
                        r={6}
                        fill="none"
                        className="map-halo stroke-emerald-500"
                        strokeWidth={2}
                      />
                    )}
                    {focusNodeId === nd.id && (
                      <circle
                        cx={x}
                        cy={mainY}
                        r={11}
                        fill="none"
                        className="map-ring stroke-zinc-400"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={mainY}
                      r={nd.type === "start" || nd.type === "merge" ? 5.5 : 4.5}
                      className={cn(dotCls, ringCls)}
                      strokeWidth={2}
                    />
                  </g>
                );
              })}
            </svg>

            {/* 支流药丸轨道 */}
            {lanes.map((lane, i) => (
              <BranchPill
                key={lane.line.id}
                lane={lane}
                index={i}
                selected={lane.line.id === selectedId}
                onSelect={() => onSelect(lane.line.id)}
                onOpenLine={
                  onOpenLine ? () => onOpenLine(lane.line.id) : undefined
                }
                onHover={setFocusNodeId}
              />
            ))}

            {/* 节点卡片 */}
            {seq.map((nd, i) => {
              const context = contextIds.has(nd.id);
              const ctxLine = context
                ? lines.find((l) => l.id === nd.lineId)
                : undefined;
              const mergeFrom = nd.mergedBranchIds
                .map((id) => {
                  if (focused && id === focused.id) return focused.name;
                  return lanes.find((l) => l.line.id === id)?.line.name;
                })
                .filter((name): name is string => !!name);
              return (
                <NodeCard
                  key={nd.id}
                  node={nd}
                  lineId={context ? originMainId : main.id}
                  x={xOf.get(nd.id) ?? 0}
                  top={cardTop}
                  index={i}
                  active={mainSelected && !context}
                  forkCount={forkCountOf(nd.id)}
                  mergeFrom={mergeFrom}
                  context={context}
                  contextLabel={
                    ctxLine && ctxLine.kind === "branch" ? "上游支线" : "主线"
                  }
                  onSelect={() =>
                    context && onExitFocus
                      ? onExitFocus()
                      : onSelect(main.id)
                  }
                />
              );
            })}
          </div>
        </div>

        {/* 图例 */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-emerald-600 ring-2 ring-white" />
            起点
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] rounded-full border border-zinc-300 bg-white" />
            进展
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-sky-500 ring-2 ring-white" />
            汇合点
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-zinc-300 ring-2 ring-white" />
            线已结束
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0" />
            主线
          </span>
        </div>
      </div>
    </MotionConfig>
  );
}
