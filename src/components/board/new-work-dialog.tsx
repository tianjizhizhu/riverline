"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GitBranch } from "@phosphor-icons/react";
import { CategorySelect, DifficultyPicker } from "@/components/ui/choice";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog } from "@/components/ui/dialog";
import { Btn, Field, FormError, TextArea, TextInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError, postJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { todayStr } from "@/lib/date";
import type { Category, Difficulty, WorkMode } from "@/lib/types";

const MODES: Array<{
  key: WorkMode;
  label: string;
  hint: string;
}> = [
  { key: "record", label: "记录模式", hint: "已在推进，随时记录进展" },
  { key: "blueprint", label: "蓝图模式", hint: "复杂工作先排好节点再启动" },
];

export function NewWorkDialog({
  open,
  onClose,
  categories,
  defaultCategoryId = null,
  defaultMode = "record",
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  defaultCategoryId?: number | null;
  /** 从蓝图管理页进入时默认选中蓝图模式 */
  defaultMode?: WorkMode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(defaultCategoryId);
  const [difficulty, setDifficulty] = useState<Difficulty>("water");
  const [firstTask, setFirstTask] = useState("");
  const [mode, setMode] = useState<WorkMode>(defaultMode);
  const [deliverTo, setDeliverTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoryId(defaultCategoryId);
    setMode(defaultMode);
    setError(null);
    setStartDate(todayStr());
  }, [open, defaultCategoryId, defaultMode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson<{ id: number }>("/api/works", {
        title,
        goal,
        startDate,
        dueDate: dueDate || null,
        categoryId,
        difficulty,
        firstTask,
        mode,
        deliverTo: deliverTo.trim(),
      });
      toast(mode === "blueprint" ? "蓝图已创建" : "工作已创建");
      setTitle("");
      setGoal("");
      setFirstTask("");
      setDueDate("");
      setStartDate(todayStr());
      setCategoryId(defaultCategoryId);
      setDifficulty("water");
      setMode(defaultMode);
      setDeliverTo("");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="新建工作"
      description="先定下目标与眼下的一步，之后随时可以 Fork 出并行支线。"
      wide
    >
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="工作名称" required hint={`${title.length}/50`}>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            placeholder="例如：完成 Q4 增长方案"
            autoFocus
            required
          />
        </Field>

        <Field label="目标" required hint={`${goal.length}/500`}>
          <TextArea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="这项工作要达成什么结果"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="开始日期" required>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              ariaLabel="开始日期"
            />
          </Field>
          <Field label="目标日期" hint="可后补">
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              clearable
              placeholder="未设目标"
              ariaLabel="目标日期"
            />
          </Field>
        </div>

        <Field label="分类" hint="在首页设置里管理分类">
          <CategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        </Field>

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

        <Field label="下一步任务" required hint={`${firstTask.length}/200`}>
          <TextArea
            value={firstTask}
            onChange={(e) => setFirstTask(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="现在马上要做的一件事"
            required
          />
        </Field>

        <Field label="创建为" hint="之后不可切换">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="创建模式">
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition active:scale-[0.98]",
                    active
                      ? "border-zinc-900 bg-zinc-900 text-zinc-50"
                      : "border-zinc-200/90 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {m.key === "blueprint" && (
                      <GitBranch
                        size={12}
                        weight="bold"
                        className={active ? "text-zinc-400" : "text-zinc-400"}
                      />
                    )}
                    {m.label}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-4",
                      active ? "text-zinc-400" : "text-zinc-400",
                    )}
                  >
                    {m.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <FormError message={error} />

        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn type="submit" loading={loading}>
            创建工作
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
