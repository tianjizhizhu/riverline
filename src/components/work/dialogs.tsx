"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, GitMerge } from "@phosphor-icons/react";
import { CategorySelect, DifficultyPicker } from "@/components/ui/choice";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Btn, Field, FormError, TextArea, TextInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, patchJson, postJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { todayStr } from "@/lib/date";
import type {
  Category,
  Difficulty,
  Line,
  NodeRow,
  Work,
  WorkStatus,
} from "@/lib/types";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : "操作失败，请稍后再试";
}

function Footer({
  onClose,
  loading,
  label,
  disabled,
  danger,
}: {
  onClose: () => void;
  loading: boolean;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Btn type="button" variant="ghost" onClick={onClose}>
        取消
      </Btn>
      <Btn type="submit" variant={danger ? "danger" : "primary"} loading={loading} disabled={disabled}>
        {label}
      </Btn>
    </div>
  );
}

/** 单选卡片：用于删除范围、分支处置等二选一场景 */
function OptionCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition active:scale-[0.99]",
        active
          ? "border-zinc-900/70 bg-zinc-100 ring-1 ring-zinc-900/10"
          : "border-zinc-200 bg-white hover:border-zinc-300",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white",
        )}
      >
        {active && <Check size={10} weight="bold" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-zinc-800">{title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-4 text-zinc-400">{desc}</span>
      </span>
    </button>
  );
}

/* ---------------- 记录进展 ---------------- */

export function ProgressDialog({
  open,
  onClose,
  onDone,
  line,
  tail,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  line: Line;
  tail: NodeRow | null;
}) {
  const toast = useToast();
  // 初始为空：打开时经 useEffect 填当天日期，预渲染期不读时钟
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [nextTask, setNextTask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(todayStr());
    setNote(tail?.nextTask ?? "");
    setNextTask("");
    setError(null);
  }, [open, tail?.nextTask]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson(`/api/lines/${line.id}/nodes`, { date, note, nextTask });
      toast("进展已记录");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="记录进展"
      description={`记录在「${line.name}」上的这一步，并写下接下来要做什么。`}
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        {tail?.nextTask && (
          <div className="rounded-lg border-l-2 border-emerald-600/70 bg-emerald-50/60 px-3 py-2">
            <p className="text-[11px] text-emerald-800/60">上一步的待办</p>
            <p className="mt-0.5 text-[13px] leading-5 text-emerald-900/90">
              {tail.nextTask}
            </p>
          </div>
        )}

        <Field label="日期" required>
          <DatePicker value={date} onChange={setDate} ariaLabel="进展日期" />
        </Field>

        <Field label="这一步的进展" hint={`${note.length}/200`}>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="做了什么、结果如何、卡在哪里"
            autoFocus
          />
        </Field>

        <Field label="下一步任务" hint="留空表示此线到此结束">
          <TextArea
            value={nextTask}
            onChange={(e) => setNextTask(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="接下来要推进的一件事"
          />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="记录" />
      </form>
    </Dialog>
  );
}

/* ---------------- Fork 分支 ---------------- */

export function ForkDialog({
  open,
  onClose,
  onDone,
  line,
  node,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  line: Line;
  node: NodeRow | null;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  // 初始为空：打开时经 useEffect 填当天日期，预渲染期不读时钟
  const [date, setDate] = useState("");
  const [firstTask, setFirstTask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDate(todayStr());
    setFirstTask("");
    setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson(`/api/lines/${line.id}/fork`, {
        nodeId: node?.id,
        name,
        date,
        firstTask,
      });
      toast("分支已创建");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Fork 出一条分支"
      description="分支与主线并行推进，之后可以汇合回主线，也可以直接关闭。"
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        {node && (
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2">
            <p className="text-[11px] text-zinc-400">从这条待办分出</p>
            <p className="mt-0.5 text-[13px] leading-5 text-zinc-700">
              {node.nextTask}
            </p>
          </div>
        )}

        <Field label="分支名称" required hint={`${name.length}/30`}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="例如：等设计稿确认"
            autoFocus
            required
          />
        </Field>

        <Field label="日期" required>
          <DatePicker value={date} onChange={setDate} ariaLabel="分支日期" />
        </Field>

        <Field label="分支的下一步任务" required hint={`${firstTask.length}/200`}>
          <TextArea
            value={firstTask}
            onChange={(e) => setFirstTask(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="这条支线先做什么"
            required
          />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="创建分支" />
      </form>
    </Dialog>
  );
}

/* ---------------- 汇合进主线 ---------------- */

export function MergeDialog({
  open,
  onClose,
  onDone,
  line,
  targets,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  line: Line;
  targets: NodeRow[];
}) {
  const toast = useToast();
  const [nodeId, setNodeId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const last = targets[targets.length - 1];
    setNodeId(last ? last.id : null);
    setNote("");
    setError(null);
  }, [open, targets]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (nodeId == null) {
      setError("请选择要汇入的主线节点");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await postJson(`/api/lines/${line.id}/merge`, { nodeId, note });
      toast("已汇合进主线");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="汇合进主线"
      description={`选择主线上的一个节点，「${line.name}」会汇入该节点，分支保留为历史。同一个节点可以接收多条分支汇入。`}
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        {targets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-[12.5px] leading-5 text-zinc-500">
            主线目前没有可汇入的节点。先到主线上记录一步进展，再回来汇合这条分支。
          </p>
        ) : (
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-zinc-600">
              汇入主线的哪个节点
            </p>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto">
              {targets.map((node) => {
                const active = node.id === nodeId;
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => setNodeId(node.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition active:scale-[0.99]",
                        active
                          ? "border-emerald-700/70 bg-emerald-50/80 ring-1 ring-emerald-700/15"
                          : "border-zinc-200 bg-white hover:border-zinc-300",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                          active
                            ? "border-emerald-700 bg-emerald-700 text-white"
                            : "border-zinc-300 bg-white",
                        )}
                      >
                        {active && <Check size={10} weight="bold" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-[11px] text-zinc-400">
                            {node.date}
                          </span>
                          <span className="text-[13px] leading-5 text-zinc-800">
                            {node.note || node.nextTask || "这一步的进展"}
                          </span>
                          {node.mergedBranchIds.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10.5px] text-sky-600">
                              <GitMerge size={10} weight="bold" />
                              已有 {node.mergedBranchIds.length} 条分支汇入
                            </span>
                          )}
                        </span>
                        {node.nextTask && node.note && (
                          <span className="mt-0.5 block truncate text-[11.5px] text-zinc-400">
                            下一步 · {node.nextTask}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Field label="汇合说明" hint={`${note.length}/200`}>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="这条分支带回了什么"
            disabled={targets.length === 0}
          />
        </Field>

        <FormError message={error} />
        <Footer
          onClose={onClose}
          loading={loading}
          label="汇合"
          disabled={targets.length === 0}
        />
      </form>
    </Dialog>
  );
}

/* ---------------- 关闭分支 ---------------- */

export function CloseDialog({
  open,
  onClose,
  onDone,
  line,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  line: Line;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson(`/api/lines/${line.id}/close`, { note });
      toast("分支已关闭");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="关闭分支"
      description={`「${line.name}」不再推进，节点会保留为历史，之后也可以重新打开。`}
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="关闭说明" required hint={`${note.length}/200`}>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="为什么不再推进"
            autoFocus
            required
          />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="关闭分支" />
      </form>
    </Dialog>
  );
}

/* ---------------- 完成分支 ---------------- */

export function CompleteDialog({
  open,
  onClose,
  onDone,
  line,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  line: Line;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson(`/api/lines/${line.id}/complete`, { note });
      toast("分支已完成");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="完成分支"
      description={`「${line.name}」这条派生任务已经做完，与主线无关，主线状态不受影响。`}
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="完成说明" required hint={`${note.length}/200`}>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="这条分支做完了什么"
            autoFocus
            required
          />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="标记完成" />
      </form>
    </Dialog>
  );
}

/* ---------------- 编辑节点 ---------------- */

export function EditNodeDialog({
  open,
  onClose,
  onDone,
  node,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  node: NodeRow | null;
}) {
  const toast = useToast();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [nextTask, setNextTask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !node) return;
    setDate(node.date);
    setNote(node.note);
    setNextTask(node.nextTask);
    setError(null);
  }, [open, node]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!node) return;
    setError(null);
    setLoading(true);
    try {
      await patchJson(`/api/nodes/${node.id}`, { date, note, nextTask });
      toast("节点已更新");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="编辑节点" wide>
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="日期" required>
          <DatePicker value={date} onChange={setDate} ariaLabel="节点日期" />
        </Field>

        <Field label="节点内容" hint={`${note.length}/200`}>
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="这一步发生了什么"
          />
        </Field>

        <Field label="下一步任务" hint="留空表示此线到此结束">
          <TextArea
            value={nextTask}
            onChange={(e) => setNextTask(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="接下来要推进的一件事"
          />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="保存" />
      </form>
    </Dialog>
  );
}

/* ---------------- 编辑工作 ---------------- */

export function EditWorkDialog({
  open,
  onClose,
  onDone,
  work,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  work: Work;
  categories: Category[];
}) {
  const toast = useToast();
  const [title, setTitle] = useState(work.title);
  const [goal, setGoal] = useState(work.goal);
  const [dueDate, setDueDate] = useState(work.dueDate ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(work.categoryId);
  const [difficulty, setDifficulty] = useState<Difficulty>(work.difficulty);
  const [deliverTo, setDeliverTo] = useState(work.deliverTo);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(work.title);
    setGoal(work.goal);
    setDueDate(work.dueDate ?? "");
    setCategoryId(work.categoryId);
    setDifficulty(work.difficulty);
    setDeliverTo(work.deliverTo);
    setError(null);
  }, [open, work]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await patchJson(`/api/works/${work.id}`, {
        title,
        goal,
        dueDate: dueDate || null,
        categoryId,
        difficulty,
        deliverTo: deliverTo.trim(),
      });
      toast("工作信息已更新");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="编辑工作" wide>
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="工作名称" required hint={`${title.length}/50`}>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            required
          />
        </Field>

        <Field label="目标" required hint={`${goal.length}/500`}>
          <TextArea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            maxLength={500}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="分类">
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </Field>
          <Field label="目标日期" hint="可清空">
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              clearable
              placeholder="未设目标"
              ariaLabel="目标日期"
            />
          </Field>
        </div>

        <Field label="交付对象" hint="选填 · 这项工作的汇报人，方便随时找他沟通">
          <TextInput
            value={deliverTo}
            onChange={(e) => setDeliverTo(e.target.value)}
            maxLength={50}
            placeholder="例如：张三（采购部）"
          />
        </Field>

        <Field label="任务分级">
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="保存" />
      </form>
    </Dialog>
  );
}

/* ---------------- 撤销结束 ---------------- */

export function UndoEndDialog({
  open,
  onClose,
  onDone,
  node,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  node: NodeRow | null;
}) {
  const toast = useToast();
  const [nextTask, setNextTask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNextTask("");
    setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!node) return;
    setError(null);
    setLoading(true);
    try {
      await patchJson(`/api/nodes/${node.id}`, { nextTask });
      toast("已撤销结束");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="撤销结束"
      description="这项工作将回到推进状态，请补上下一步任务。"
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="下一步任务" required hint={`${nextTask.length}/200`}>
          <TextArea
            value={nextTask}
            onChange={(e) => setNextTask(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="接下来还要做什么"
            autoFocus
            required
          />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="撤销结束" />
      </form>
    </Dialog>
  );
}

/* ---------------- 复制蓝图 ---------------- */

export function CopyBlueprintDialog({
  open,
  onClose,
  onCopied,
  work,
}: {
  open: boolean;
  onClose: () => void;
  onCopied: (newId: number) => void;
  work: Work | null;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 打开时预填「原标题 副本」，便于直接改名套用到新的研究上
  useEffect(() => {
    if (!open || !work) return;
    setTitle(`${work.title} 副本`);
    setError(null);
  }, [open, work]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!work) return;
    setError(null);
    setLoading(true);
    try {
      const id = await api.duplicateBlueprint(work.id, title);
      toast("蓝图已复制");
      onCopied(id);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="复制蓝图"
      description="整套线路、节点、分支与汇合结构会原样复制成一份新蓝图，不带任何孵化关联，可改名后套用到新的研究上。"
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="新蓝图名称" required hint={`${title.length}/50`}>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            placeholder="例如：XX 领域调研蓝图"
            autoFocus
            required
          />
        </Field>

        <FormError message={error} />
        <Footer onClose={onClose} loading={loading} label="复制" />
      </form>
    </Dialog>
  );
}

/* ---------------- 删除节点 ---------------- */

/** 收集由删除节点 fork 出的分支，并沿父子关系递归展开（与服务端逻辑一致） */
function cascadeBranchLines(lines: Line[], seedNodeIds: Set<number>): Line[] {
  const out: Line[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const l of lines) {
      if (l.kind !== "branch" || out.some((x) => x.id === l.id)) continue;
      const forkGone = l.forkNodeId != null && seedNodeIds.has(l.forkNodeId);
      const parentGone =
        l.parentLineId != null && out.some((x) => x.id === l.parentLineId);
      if (forkGone || parentGone) {
        out.push(l);
        changed = true;
      }
    }
  }
  return out;
}

export function DeleteNodeDialog({
  open,
  onClose,
  onDone,
  node,
  line,
  lines,
  nodes,
  status,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  node: NodeRow | null;
  line: Line | null;
  lines: Line[];
  nodes: NodeRow[];
  status: WorkStatus;
}) {
  const toast = useToast();
  const [downstream, setDownstream] = useState(false);
  const [branches, setBranches] = useState<"cascade" | "keep">("keep");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 删除预览：范围节点数、受影响分支、会解除汇合的分支、是否留下空线路
  const preview = useMemo(() => {
    if (!node) return null;
    const sameLine = nodes.filter((n) => n.lineId === node.lineId);
    const scope = downstream ? sameLine.filter((n) => n.seq >= node.seq) : [node];
    const ids = new Set(scope.map((n) => n.id));
    return {
      scope,
      sameLineCount: sameLine.length,
      remain: sameLine.filter((n) => !ids.has(n.id)).length,
      cascade: cascadeBranchLines(lines, ids),
      mergedBack: scope.flatMap((n) => n.mergedBranchIds),
    };
  }, [node, nodes, lines, downstream]);

  useEffect(() => {
    if (!open) return;
    setDownstream(false);
    setBranches("keep");
    setError(null);
  }, [open, node?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!node) return;
    setError(null);
    setLoading(true);
    try {
      await api.deleteNodes(node.id, { downstream, branches });
      toast("节点已删除，可在 10 步内撤销");
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  if (!node || !line || !preview) return null;

  const wouldEmpty = preview.remain === 0;
  const hasBranchImpact = preview.cascade.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="删除节点"
      description="删除后可在顶部用「撤销」恢复，超过 10 步新操作后则无法回退。"
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2">
          <p className="text-[11px] text-zinc-400">将删除</p>
          <p className="mt-0.5 text-[13px] leading-5 text-zinc-700">
            {node.note || node.nextTask || "（空白节点）"}
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-zinc-600">删除范围</p>
          <div className="space-y-1.5">
            <OptionCard
              active={!downstream}
              onClick={() => setDownstream(false)}
              title="仅当前节点"
              desc={`「${line.name}」其余 ${preview.remain} 个节点不受影响`}
            />
            <OptionCard
              active={downstream}
              onClick={() => setDownstream(true)}
              title="当前节点及其后的所有节点"
              desc={`共 ${preview.scope.length} 个节点（该线路共 ${preview.sameLineCount} 个）`}
            />
          </div>
        </div>

        {hasBranchImpact && (
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-zinc-600">
              从这些节点分出的 {preview.cascade.length} 条分支怎么办
            </p>
            <div className="space-y-1.5">
              <OptionCard
                active={branches === "keep"}
                onClick={() => setBranches("keep")}
                title="保留分支"
                desc="分支的 Fork 点前移到删除位置之前最近的存活节点，分支继续推进"
              />
              <OptionCard
                active={branches === "cascade"}
                onClick={() => setBranches("cascade")}
                title="分支一并删除"
                desc={`连带删除这 ${preview.cascade.length} 条分支及其全部节点`}
              />
            </div>
          </div>
        )}

        {preview.mergedBack.length > 0 && (
          <p className="rounded-lg border-l-2 border-amber-500/70 bg-amber-50/70 px-3 py-2 text-[12px] leading-5 text-amber-800">
            有 {preview.mergedBack.length} 条分支汇入将被删的节点，删除后这些分支会解除汇合、回到进行中。
          </p>
        )}
        {node.type === "start" && (
          <p className="rounded-lg border-l-2 border-sky-500/70 bg-sky-50/70 px-3 py-2 text-[12px] leading-5 text-sky-800">
            删除的是起点节点，「{line.name}」下一个存活节点会自动升为起点。
          </p>
        )}
        {wouldEmpty && (
          <p className="rounded-lg border-l-2 border-rose-500/70 bg-rose-50/70 px-3 py-2 text-[12px] leading-5 text-rose-800">
            删除后「{line.name}」将没有任何节点，每条线路至少需要保留一个节点。
          </p>
        )}

        <FormError message={error} />
        <Footer
          onClose={onClose}
          loading={loading}
          label="删除"
          disabled={wouldEmpty || status === "done"}
          danger
        />
      </form>
    </Dialog>
  );
}
