import type { Line, NodeRow, WorkStatus } from "./types";

/** 一条线的末尾节点「下一步任务」为空，即该线结束。 */
export function lineEnded(nodes: NodeRow[]): boolean {
  const tail = nodes[nodes.length - 1];
  return tail ? tail.nextTask === "" : false;
}

/** 工作状态由主线派生：主线走到结束节点即完成。 */
export function workStatusOf(lines: Line[], nodes: NodeRow[]): WorkStatus {
  const main = lines.find((l) => l.kind === "main");
  if (!main) return "active";
  const mainNodes = nodes.filter((n) => n.lineId === main.id);
  return lineEnded(mainNodes) ? "done" : "active";
}

/** 某条线能否提交进展。 */
export function lineAcceptsProgress(line: Line, nodes: NodeRow[], status: WorkStatus): boolean {
  if (line.kind === "branch" && line.status !== "active") return false;
  if (line.kind === "main" && status === "done") return false;
  return !lineEnded(nodes);
}

/** 某条线上能否从指定节点 Fork。 */
export function lineAcceptsFork(line: Line, node: NodeRow, status: WorkStatus): boolean {
  if (node.nextTask === "") return false;
  if (line.kind === "branch" && line.status !== "active") return false;
  if (line.kind === "main" && status === "done") return false;
  return true;
}

/**
 * 分支可以汇合进的主线节点：位于 Fork 点之后的进展节点或既有汇合点。
 * 一个节点允许多条分支汇入，因此已承载分支的节点仍可作为汇合目标。
 * 业务上支线要汇合，主线一定已经走出了可分合的节点。
 */
export function mergeTargets(
  lines: Line[],
  nodes: NodeRow[],
  branch: Line,
): NodeRow[] {
  const main = lines.find((l) => l.kind === "main");
  if (!main) return [];
  const mainNodes = nodes.filter((n) => n.lineId === main.id);
  const fork = branch.forkNodeId
    ? mainNodes.find((n) => n.id === branch.forkNodeId)
    : undefined;
  const minSeq = fork?.seq ?? 0;
  return mainNodes.filter(
    (n) => (n.type === "progress" || n.type === "merge") && n.seq >= minSeq,
  );
}
