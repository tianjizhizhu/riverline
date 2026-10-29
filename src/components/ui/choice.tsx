"use client";

import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { orderedCategories } from "@/lib/category";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { Category, Difficulty } from "@/lib/types";

export function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full appearance-none rounded-lg border border-zinc-300/80 bg-white py-2 pl-3 pr-9 text-sm text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
      >
        <option value="">未分类</option>
        {orderedCategories(categories).map((c) => (
          <option key={c.id} value={c.id}>
            {c.parentId == null ? c.name : `\u00A0\u00A0└ ${c.name}`}
          </option>
        ))}
      </select>
      <CaretDown
        size={13}
        weight="bold"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
      />
    </div>
  );
}

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {DIFFICULTIES.map((d) => {
        const active = d.value === value;
        return (
          <button
            key={d.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(d.value)}
            className={cn(
              "rounded-lg border px-2 py-2 text-left transition active:scale-[0.98]",
              active
                ? "border-emerald-700/70 bg-emerald-50/80 ring-1 ring-emerald-700/15"
                : "border-zinc-200 bg-white hover:border-zinc-300",
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", d.dot)} />
              <span
                className={cn(
                  "text-[12px] font-medium",
                  active ? "text-emerald-900" : "text-zinc-600",
                )}
              >
                {d.label}
              </span>
            </span>
            <span className="mt-0.5 block text-[10.5px] leading-4 text-zinc-400">
              {d.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
