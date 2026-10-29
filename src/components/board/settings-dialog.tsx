"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, Check, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { Btn, FormError, TextInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError, del, patchJson, postJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { orderedCategories, topCategories } from "@/lib/category";
import type { Category } from "@/lib/types";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : "操作失败，请稍后再试";
}

export function SettingsDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewName("");
    setNewParentId(null);
    setEditingId(null);
    setPendingDelete(null);
    setError(null);
  }, [open]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson("/api/categories", { name: newName, parentId: newParentId });
      setNewName("");
      setNewParentId(null);
      toast("分类已添加");
      router.refresh();
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setDraft(category.name);
    setPendingDelete(null);
    setError(null);
  };

  const saveEdit = async (id: number) => {
    setError(null);
    try {
      await patchJson(`/api/categories/${id}`, { name: draft });
      setEditingId(null);
      toast("分类已重命名");
      router.refresh();
    } catch (err) {
      setError(errText(err));
    }
  };

  const remove = async (id: number) => {
    setError(null);
    try {
      await del(`/api/categories/${id}`);
      setPendingDelete(null);
      toast("分类已删除，原分类下的工作转为未分类");
      router.refresh();
    } catch (err) {
      setError(errText(err));
    }
  };

  const parentName =
    newParentId == null ? null : categories.find((c) => c.id === newParentId)?.name ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="设置"
      description="管理工作的分类，支持两级目录。删除分类后，这类工作会回到「未分类」。"
      wide
    >
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <TextInput
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={20}
            placeholder={
              parentName ? `在「${parentName}」下新建子分类` : "新分类名称，例如：产品、客户、内部"
            }
            aria-label="新分类名称"
          />
        </div>
        <div className="relative">
          <select
            value={newParentId ?? ""}
            onChange={(e) => setNewParentId(e.target.value === "" ? null : Number(e.target.value))}
            aria-label="父分类"
            className="h-9 appearance-none rounded-lg border border-zinc-300/80 bg-white pl-3 pr-8 text-[13px] text-zinc-700 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
          >
            <option value="">一级分类</option>
            {topCategories(categories).map((c) => (
              <option key={c.id} value={c.id}>
                归入「{c.name}」
              </option>
            ))}
          </select>
          <CaretDown
            size={12}
            weight="bold"
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
        </div>
        <Btn type="submit" loading={loading} disabled={!newName.trim()}>
          <Plus size={14} weight="bold" />
          添加
        </Btn>
      </form>

      <div className="mt-4">
        <p className="mb-1.5 text-[13px] font-medium text-zinc-700">
          分类列表
          <span className="ml-1.5 text-[11px] font-normal text-zinc-400">
            {categories.length}
          </span>
        </p>

        {categories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400">
            还没有分类，先添加一个。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200/80">
            {orderedCategories(categories).map((c) => {
              const editing = editingId === c.id;
              const confirming = pendingDelete === c.id;
              const depth = c.parentId == null ? 0 : 1;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-center gap-2 py-2",
                    depth > 0 ? "bg-zinc-50/50 pl-8 pr-3" : "px-3",
                  )}
                >
                  {editing ? (
                    <>
                      <TextInput
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={20}
                        autoFocus
                        aria-label="分类名称"
                        className="h-8 py-1 text-[13px]"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(c.id)}
                        aria-label="保存"
                        className="rounded-md p-1 text-emerald-700 transition hover:bg-emerald-50 active:scale-95"
                      >
                        <Check size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="取消"
                        className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 active:scale-95"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    </>
                  ) : confirming ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-600">
                        删除「{c.name}」？
                      </span>
                      <Btn
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => remove(c.id)}
                      >
                        删除
                      </Btn>
                      <Btn
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(null)}
                      >
                        取消
                      </Btn>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700">
                        {depth > 0 && <span className="mr-1 text-zinc-300">└</span>}
                        {c.name}
                      </span>
                      {depth === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewParentId(c.id);
                            setNewName("");
                            setError(null);
                          }}
                          aria-label={`在 ${c.name} 下添加子分类`}
                          title="添加子分类"
                          className="rounded-md p-1 text-zinc-300 transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
                        >
                          <Plus size={14} weight="bold" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        aria-label={`重命名 ${c.name}`}
                        className="rounded-md p-1 text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600 active:scale-95"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(c.id)}
                        aria-label={`删除 ${c.name}`}
                        className="rounded-md p-1 text-zinc-300 transition hover:bg-red-50 hover:text-red-500 active:scale-95"
                      >
                        <Trash size={14} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
