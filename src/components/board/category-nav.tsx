"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown, CaretRight, Blueprint } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { categoryPath, childCategories, topCategories } from "@/lib/category";
import type { Category } from "@/lib/types";

export type CategoryFilter = "all" | "none" | "blueprints" | number;

export type CategoryCounts = {
  /** 分类自身的工作数 */
  map: Map<number, number>;
  /** 一级分类含子分类的工作数 */
  group: Map<number, number>;
  uncategorized: number;
  total: number;
};

type Variant = "rail" | "panel";

type TreeProps = {
  categories: Category[];
  counts: CategoryCounts;
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
  /** 已折叠的一级分类 id 集合 */
  collapsed: Set<number>;
  onToggleCollapse: (id: number) => void;
  variant: Variant;
  /** 蓝图数量，分类栏末尾「蓝图管理」入口 */
  blueprintCount?: number;
};

function CaretToggle({
  open,
  label,
  variant,
  onClick,
}: {
  open: boolean;
  label: string;
  variant: Variant;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${open ? "折叠" : "展开"}${label}`}
      aria-expanded={open}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:text-zinc-700 active:scale-90",
        variant === "rail" ? "h-6 w-4" : "h-8 w-6",
      )}
    >
      <motion.span
        animate={{ rotate: open ? 90 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="flex"
      >
        <CaretRight size={variant === "rail" ? 10 : 12} weight="fill" />
      </motion.span>
    </button>
  );
}

function TreeRow({
  active,
  label,
  count,
  depth = 0,
  variant,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  count: number;
  depth?: number;
  variant: Variant;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg text-left transition active:scale-[0.98]",
        variant === "rail"
          ? depth === 0
            ? "px-2 py-1.5 text-[13px]"
            : "pl-2 pr-2 py-1.5 text-[12px]"
          : depth === 0
            ? "px-2.5 py-2 text-[13px]"
            : "px-2.5 py-2 text-[13px]",
        active
          ? "bg-zinc-900 font-medium text-zinc-50"
          : "text-zinc-600 hover:bg-white hover:text-zinc-900",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {icon && (
          <span className={cn("shrink-0", active ? "text-zinc-300" : "text-zinc-400")}>
            {icon}
          </span>
        )}
        <span className="truncate">
          {depth > 0 && <span className={active ? "text-zinc-400" : "text-zinc-300"}>└ </span>}
          {label}
        </span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{count}</span>
    </button>
  );
}

/** 分类树主体：一级分类可折叠，子分类缩进展示 */
function CategoryTree({
  categories,
  counts,
  value,
  onChange,
  collapsed,
  onToggleCollapse,
  variant,
  blueprintCount = 0,
}: TreeProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <TreeRow
        variant={variant}
        active={value === "all"}
        label="全部"
        count={counts.total}
        onClick={() => onChange("all")}
      />
      {topCategories(categories).map((p) => {
        const kids = childCategories(categories, p.id);
        const open = !collapsed.has(p.id);
        return (
          <div key={p.id} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0.5">
              {kids.length > 0 ? (
                <CaretToggle
                  open={open}
                  label={p.name}
                  variant={variant}
                  onClick={() => onToggleCollapse(p.id)}
                />
              ) : (
                <span
                  className={cn("shrink-0", variant === "rail" ? "w-4" : "w-6")}
                  aria-hidden
                />
              )}
              <TreeRow
                variant={variant}
                active={value === p.id}
                label={p.name}
                count={counts.group.get(p.id) ?? 0}
                onClick={() => onChange(p.id)}
              />
            </div>
            <AnimatePresence initial={false}>
              {open &&
                kids.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 450, damping: 36 }}
                    className={cn("overflow-hidden", variant === "panel" && "pl-6")}
                  >
                    <TreeRow
                      variant={variant}
                      depth={1}
                      active={value === c.id}
                      label={c.name}
                      count={counts.map.get(c.id) ?? 0}
                      onClick={() => onChange(c.id)}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        );
      })}
      <TreeRow
        variant={variant}
        active={value === "none"}
        label="未分类"
        count={counts.uncategorized}
        onClick={() => onChange("none")}
      />
      <div className="my-1.5 border-t border-zinc-200/80" aria-hidden />
      <TreeRow
        variant={variant}
        active={value === "blueprints"}
        label="蓝图管理"
        count={blueprintCount ?? 0}
        icon={<Blueprint size={variant === "rail" ? 13 : 14} weight="regular" />}
        onClick={() => onChange("blueprints")}
      />
    </div>
  );
}

/** 桌面侧栏分类导航 */
export function CategoryNav(props: Omit<TreeProps, "variant">) {
  return <CategoryTree {...props} variant="rail" />;
}

/** 移动端分类导航：收起时显示当前分类，展开为下拉树，保留父子层级 */
export function MobileCategoryNav(props: Omit<TreeProps, "variant">) {
  const [open, setOpen] = useState(false);
  const { categories, value, onChange } = props;
  const label =
    value === "all"
      ? "全部"
      : value === "none"
        ? "未分类"
        : value === "blueprints"
          ? "蓝图管理"
          : (categoryPath(categories, value) ?? "全部");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-[13px] transition active:scale-[0.99]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-zinc-400">分类</span>
          <span className="truncate font-medium text-zinc-800">{label}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="flex shrink-0"
        >
          <CaretDown size={13} weight="bold" className="text-zinc-400" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="收起分类面板"
              tabIndex={-1}
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
              className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-[58dvh] overflow-y-auto rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-xl shadow-zinc-900/5"
            >
              <CategoryTree
                {...props}
                variant="panel"
                onChange={(v) => {
                  onChange(v);
                  setOpen(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
