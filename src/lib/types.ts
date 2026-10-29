export type LineStatus = "active" | "closed" | "completed" | "merged";
export type LineKind = "main" | "branch";
export type NodeType = "start" | "progress" | "merge";
export type WorkStatus = "active" | "done";
export type WorkMode = "record" | "blueprint";
export type Difficulty = "water" | "sparkling" | "soda";

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  createdAt: string;
}

export interface Work {
  id: number;
  title: string;
  goal: string;
  startDate: string;
  dueDate: string | null;
  categoryId: number | null;
  difficulty: Difficulty;
  /** 记录模式为正常任务；蓝图模式为规划原稿，只在蓝图管理页展示 */
  mode: WorkMode;
  /** 蓝图孵化的记录任务 id：记录任务指向它的蓝图；未孵化蓝图为 null */
  blueprintId: number | null;
  /** 交付对象（汇报人）：非必填，未填为空串 */
  deliverTo: string;
  createdAt: string;
}

export interface Line {
  id: number;
  workId: number;
  kind: LineKind;
  name: string;
  status: LineStatus;
  parentLineId: number | null;
  forkNodeId: number | null;
  closedNote: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface NodeRow {
  id: number;
  lineId: number;
  type: NodeType;
  date: string;
  note: string;
  nextTask: string;
  fromBranchId: number | null;
  /** 汇入该节点的全部分支，按汇合先后排序；同一节点可被多条分支汇入 */
  mergedBranchIds: number[];
  seq: number;
  createdAt: string;
}

/** 汇合记录行：一条分支汇入一个节点，一行一次汇合 */
export interface MergeRow {
  id: number;
  nodeId: number;
  lineId: number;
  note: string;
  closedAt: string;
}

/**
 * 工作快照：撤销/重做时整体还原用的数据结构。
 * 线路、节点、汇合记录均保留原 id，还原时按 id 原样重建。
 */
export interface WorkSnapshot {
  work: {
    title: string;
    goal: string;
    startDate: string;
    dueDate: string | null;
    categoryId: number | null;
    difficulty: Difficulty;
    deliverTo: string;
  };
  lines: Array<{
    id: number;
    kind: LineKind;
    name: string;
    status: LineStatus;
    parentLineId: number | null;
    forkNodeId: number | null;
    closedNote: string | null;
    closedAt: string | null;
  }>;
  nodes: Array<{
    id: number;
    lineId: number;
    type: NodeType;
    date: string;
    note: string;
    nextTask: string;
    fromBranchId: number | null;
    seq: number;
  }>;
  merges: Array<{
    id: number;
    nodeId: number;
    lineId: number;
    note: string;
    closedAt: string;
  }>;
}

export interface WorkDetail {
  work: Work;
  lines: Line[];
  nodes: NodeRow[];
}

export interface WorkSummary {
  work: Work;
  status: WorkStatus;
  categoryName: string | null;
  currentTask: string;
  currentIsEnd: boolean;
  branchTotal: number;
  branchActive: number;
  nodeCount: number;
  /** 全部线路中最近一次写入节点的时间，用于「按更新顺序」排列 */
  lastActivityAt: string;
}

/** 蓝图管理页卡片：蓝图本身的信息 + 孵化状态 */
export interface BlueprintSummary {
  work: Work;
  nodeCount: number;
  branchTotal: number;
  /** 孵化出的记录任务；未孵化为 null */
  spawned: Work | null;
  spawnedCurrentTask: string;
  spawnedNodeCount: number;
  /** 蓝图完成状态跟随记录任务：未孵化视为进行中 */
  status: WorkStatus;
}
