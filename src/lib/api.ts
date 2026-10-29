import type {
  BlueprintSummary,
  Category,
  Line,
  MergeRow,
  NodeRow,
  Work,
  WorkSnapshot,
  WorkSummary,
} from "./types";

export class ApiError extends Error {}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json();
  if (!res.ok || data?.ok === false)
    throw new ApiError(data?.message ?? "请求失败");
  return data as T;
}

export function postJson<T>(url: string, body?: unknown): Promise<T> {
  return req<T>(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function patchJson<T>(url: string, body?: unknown): Promise<T> {
  return req<T>(url, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function del<T>(url: string): Promise<T> {
  return req<T>(url, { method: "DELETE" });
}

export function delJson<T>(url: string, body?: unknown): Promise<T> {
  return req<T>(url, {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const enc = encodeURIComponent;

export const api = {
  /** 全部工作摘要，含孵化的记录任务；蓝图不在其中 */
  listWorks: () => req<{ ok: true; data: WorkSummary[] }>("/api/works").then((r) => r.data),

  /** 蓝图管理页数据 */
  listBlueprints: () =>
    req<{ ok: true; data: BlueprintSummary[] }>("/api/blueprints").then((r) => r.data),

  createCategory: (name: string, parentId: number | null) =>
    req<{ ok: true; data: Category }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name, parentId }),
    }).then((r) => r.data),

  renameCategory: (id: number, name: string) =>
    req(`/api/categories/${enc(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  deleteCategory: (id: number) =>
    req(`/api/categories/${enc(id)}`, { method: "DELETE" }),

  createWork: (input: {
    title: string;
    goal: string;
    startDate: string;
    dueDate: string | null;
    categoryId: number | null;
    difficulty: string;
    firstTask: string;
    mode: "record" | "blueprint";
    /** 交付对象（汇报人），非必填 */
    deliverTo?: string;
  }) =>
    req<{ ok: true; data: { id: number } }>("/api/works", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data.id),

  /** 蓝图孵化为记录任务，返回新记录任务 id */
  spawnWork: (blueprintId: number) =>
    req<{ ok: true; data: { id: number } }>(`/api/works/${enc(blueprintId)}/spawn`, {
      method: "POST",
    }).then((r) => r.data.id),

  patchWork: (
    id: number,
    patch: Partial<{
      title: string;
      goal: string;
      dueDate: string | null;
      categoryId: number | null;
      difficulty: string;
      deliverTo: string;
    }>,
  ) => req(`/api/works/${enc(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteWork: (id: number) => req(`/api/works/${enc(id)}`, { method: "DELETE" }),

  getWorkDetail: (id: number) =>
    req<{
      ok: true;
      data: {
        work: Work;
        lines: Line[];
        nodes: NodeRow[];
        merges: MergeRow[];
        blueprint: unknown;
      };
    }>(`/api/works/${enc(id)}`).then((r) => r.data),

  appendNode: (lineId: number, input: { date?: string; note?: string; nextTask?: string }) =>
    req<{ ok: true; data: NodeRow }>(`/api/lines/${enc(lineId)}/nodes`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data),

  patchNode: (id: number, patch: { date?: string; note?: string; nextTask?: string }) =>
    req(`/api/nodes/${enc(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteNode: (id: number) => req(`/api/nodes/${enc(id)}`, { method: "DELETE" }),

  /** 删除节点：可选连同其后节点、以及对分支的处置方式 */
  deleteNodes: (id: number, opts: { downstream: boolean; branches: "cascade" | "keep" }) =>
    delJson<{
      ok: true;
      data: { deletedNodes: number; deletedLines: number };
    }>(`/api/nodes/${enc(id)}`, opts).then((r) => r.data),

  /** 在某节点之后插入空白进展节点，返回新节点 */
  insertNodeAfter: (id: number) =>
    postJson<{ ok: true; data: NodeRow }>(`/api/nodes/${enc(id)}/insert`).then((r) => r.data),

  /** 复制蓝图，返回新蓝图 id */
  duplicateBlueprint: (id: number, title: string) =>
    postJson<{ ok: true; data: { id: number } }>(`/api/works/${enc(id)}/duplicate`, {
      title,
    }).then((r) => r.data.id),

  /** 按快照整体还原工作（撤销/重做） */
  restoreWork: (id: number, snapshot: WorkSnapshot) =>
    postJson(`/api/works/${enc(id)}/restore`, { snapshot }),

  fork: (
    lineId: number,
    input: { nodeId: number; name: string; date?: string; firstTask: string },
  ) =>
    req<{ ok: true; data: { lineId: number } }>(`/api/lines/${enc(lineId)}/fork`, {
      method: "POST",
      body: JSON.stringify(input),
    }).then((r) => r.data.lineId),

  merge: (lineId: number, input: { nodeId: number; note: string }) =>
    req(`/api/lines/${enc(lineId)}/merge`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  unmerge: (lineId: number) =>
    req(`/api/lines/${enc(lineId)}/unmerge`, { method: "POST" }),

  completeLine: (lineId: number, note: string) =>
    req(`/api/lines/${enc(lineId)}/complete`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  closeLine: (lineId: number, note: string) =>
    req(`/api/lines/${enc(lineId)}/close`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  reopenLine: (lineId: number) =>
    req(`/api/lines/${enc(lineId)}/reopen`, { method: "POST" }),
};
