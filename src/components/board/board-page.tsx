"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClockCountdown,
  Fire,
  GearSix,
  GitBranch,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import { SiteHeader } from "@/components/site-header";
import { Btn } from "@/components/ui/field";
import { StatusDot } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { categoryGroupIds, topCategories } from "@/lib/category";
import { todayStr } from "@/lib/date";
import { sortByRecent, sortByUrgent } from "@/lib/order";
import { api } from "@/lib/api";
import type { BlueprintSummary, Category, Work, WorkStatus, WorkSummary } from "@/lib/types";
import { BlueprintCard } from "./blueprint-card";
import { CategoryFilter, CategoryNav, MobileCategoryNav } from "./category-nav";
import { NewWorkDialog } from "./new-work-dialog";
import { SettingsDialog } from "./settings-dialog";
import { WorkCard } from "./work-card";
import { CopyBlueprintDialog } from "@/components/work/dialogs";

const COLUMNS: Array<{ key: WorkStatus; label: string; hint: string }> = [
  { key: "active", label: "进行中", hint: "主线仍在推进" },
  { key: "done", label: "已完成", hint: "主线走到结束节点" },
];

const ORDERS: Array<{ key: "recent" | "urgent"; label: string; icon: typeof Fire }> = [
  { key: "recent", label: "最近更新", icon: ClockCountdown },
  { key: "urgent", label: "紧急优先", icon: Fire },
];

const FILTERS: Array<{ key: "all" | WorkStatus; label: string }> = [
  { key: "all", label: "全部" },
  { key: "active", label: "进行中" },
  { key: "done", label: "已完成" },
];

export function BoardPage({
  initial,
  categories,
}: {
  initial: WorkSummary[];
  categories: Category[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | WorkStatus>("active");
  const [order, setOrder] = useState<"recent" | "urgent">("recent");
  const [category, setCategory] = useState<CategoryFilter>("all");
  // 已折叠的一级分类，桌面侧栏与移动端下拉树共用
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapse = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState(false);
  // 蓝图管理视图：左侧分类栏末尾入口，只展示蓝图，不参与上半区分类体系
  const [blueprintMode, setBlueprintMode] = useState(false);
  const [blueprints, setBlueprints] = useState<BlueprintSummary[] | null>(null);
  // 待复制的蓝图：卡片上点复制后弹改名对话框
  const [copying, setCopying] = useState<Work | null>(null);
  // 当天日期在挂载后取：预渲染期不读时钟，未就绪时紧急排序先按分级兜底
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayStr()), []);

  const blueprintCount = blueprints?.length ?? 0;

  // 蓝图计数常驻左侧分类栏，挂载即拉；进入蓝图管理时再刷新保证最新
  useEffect(() => {
    let alive = true;
    api
      .listBlueprints()
      .then((list) => {
        if (alive) setBlueprints(list);
      })
      .catch(() => {
        if (alive) setBlueprints([]);
      });
    return () => {
      alive = false;
    };
  }, [blueprintMode]);

  const refreshBlueprints = () => api.listBlueprints().then(setBlueprints).catch(() => setBlueprints([]));

  const enterBlueprints = () => {
    setBlueprintMode(true);
  };
  const exitBlueprints = () => {
    setBlueprintMode(false);
    setCategory("all");
  };

  const onCategoryChange = (v: CategoryFilter) => {
    if (v === "blueprints") enterBlueprints();
    else {
      setBlueprintMode(false);
      setCategory(v);
    }
  };

  // 分类计数跟随视图筛选：全部 / 进行中 / 已完成 各自口径
  const counts = useMemo(() => {
    const scoped =
      filter === "all" ? initial : initial.filter((s) => s.status === filter);
    const map = new Map<number, number>();
    let uncategorized = 0;
    for (const s of scoped) {
      if (s.work.categoryId == null) uncategorized += 1;
      else map.set(s.work.categoryId, (map.get(s.work.categoryId) ?? 0) + 1);
    }
    const group = new Map<number, number>();
    for (const p of topCategories(categories)) {
      group.set(
        p.id,
        categoryGroupIds(categories, p.id).reduce(
          (sum, id) => sum + (map.get(id) ?? 0),
          0,
        ),
      );
    }
    return { map, uncategorized, group, total: scoped.length };
  }, [initial, categories, filter]);

  const inCategory = useMemo(
    () =>
      initial.filter((s) =>
        category === "all"
          ? true
          : category === "none"
            ? s.work.categoryId == null
            : category === "blueprints"
              ? false
              : categoryGroupIds(categories, category).includes(s.work.categoryId ?? -1),
      ),
    [initial, category, categories],
  );

  const kw = keyword.trim().toLowerCase();

  const scoped = useMemo(
    () =>
      kw === ""
        ? inCategory
        : inCategory.filter((s) => s.work.title.toLowerCase().includes(kw)),
    [inCategory, kw],
  );

  const byStatus = useMemo(() => {
    const map: Record<WorkStatus, WorkSummary[]> = { active: [], done: [] };
    for (const s of scoped) map[s.status].push(s);
    return map;
  }, [scoped]);

  const orderedActive = useMemo(
    () =>
      order === "recent"
        ? sortByRecent(byStatus.active)
        : sortByUrgent(byStatus.active, today),
    [byStatus, order, today],
  );

  const visible = filter === "all" ? COLUMNS : COLUMNS.filter((c) => c.key === filter);
  const activeCount = initial.filter((s) => s.status === "active").length;
  // 只筛一列时该列占满整行，内部卡片仍按两列排布，保持信息密度
  const solo = visible.length === 1;

  const bpKw = keyword.trim().toLowerCase();
  const visibleBlueprints = (blueprints ?? []).filter(
    (b) => bpKw === "" || b.work.title.toLowerCase().includes(bpKw),
  );

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" onClick={() => setSettings(true)}>
            <GearSix size={14} />
            设置
          </Btn>
          <Btn size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} weight="bold" />
            新建工作
          </Btn>
        </div>
      </SiteHeader>

      <main className="mx-auto max-w-[1180px] px-5 pb-20 pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              {blueprintMode
                ? "蓝图管理"
                : initial.length > 0
                  ? `${initial.length} 项工作在册，${activeCount} 项推进中`
                  : "工作脉络看板"}
            </h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              {blueprintMode
                ? "复杂工作先在这里排好节点，规划完成后一键生成记录任务。"
                : "主线往前走，并行的事 Fork 成支流，随时记录走到哪一步。"}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="relative w-full sm:w-60">
              <MagnifyingGlass
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={blueprintMode ? "按标题搜索蓝图" : "按标题搜索"}
                aria-label={blueprintMode ? "按标题搜索蓝图" : "按标题搜索工作"}
                className="w-full rounded-lg border border-zinc-200/80 bg-white py-1.5 pl-8 pr-8 text-xs text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
              {keyword !== "" && (
                <button
                  type="button"
                  onClick={() => setKeyword("")}
                  aria-label="清除搜索"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition hover:text-zinc-700"
                >
                  <X size={12} weight="bold" />
                </button>
              )}
            </div>

            {!blueprintMode && (
              <div className="flex rounded-lg border border-zinc-200/80 bg-white p-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "rounded-[6px] px-2.5 py-1 text-xs font-medium transition",
                      filter === f.key
                        ? "bg-zinc-900 text-zinc-50"
                        : "text-zinc-500 hover:text-zinc-800",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {blueprintMode ? (
          <div className="mt-7">
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
                <GitBranch size={13} weight="bold" className="text-zinc-400" />
                全部蓝图
                <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium tabular-nums text-zinc-500">
                  {visibleBlueprints.length}
                </span>
              </span>
              <Btn size="sm" variant="ghost" onClick={exitBlueprints}>
                返回看板
              </Btn>
            </div>

            {blueprints === null ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 py-16 text-center text-xs text-zinc-300">
                正在载入蓝图…
              </div>
            ) : visibleBlueprints.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-14 text-center">
                <p className="text-[13px] text-zinc-500">
                  {bpKw !== ""
                    ? `没有标题包含「${keyword.trim()}」的蓝图。`
                    : "还没有蓝图。复杂工作可以先在这里规划节点。"}
                </p>
                {bpKw !== "" ? (
                  <Btn className="mt-4" size="sm" variant="ghost" onClick={() => setKeyword("")}>
                    清除搜索
                  </Btn>
                ) : (
                  <Btn
                    className="mt-4"
                    size="sm"
                    onClick={() => {
                      setCreating(true);
                    }}
                  >
                    <Plus size={13} weight="bold" />
                    新建蓝图
                  </Btn>
                )}
              </div>
            ) : (
              <motion.div layout className="grid items-start gap-3 md:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {visibleBlueprints.map((b, i) => (
                    <BlueprintCard
                      key={b.work.id}
                      summary={b}
                      index={i}
                      today={today}
                      onCopy={setCopying}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        ) : initial.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-300">
              <GitBranch size={24} />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-zinc-800">
              第一项工作从这里开始
            </h2>
            <p className="mt-1 max-w-xs text-[13px] leading-5 text-zinc-500">
              记录目标与眼下的一步；出现并行事项时，随时 Fork 出一条支流。
            </p>
            <Btn className="mt-5" onClick={() => setCreating(true)}>
              <Plus size={14} weight="bold" />
              新建工作
            </Btn>
          </div>
        ) : (
          <div className="mt-7 grid items-start gap-6 md:grid-cols-[164px_1fr]">
            <aside className="hidden md:block">
              <p className="px-2 text-[11px] font-medium tracking-wide text-zinc-400">
                分类
              </p>
              <div className="mt-1.5">
                <CategoryNav
                  categories={categories}
                  counts={counts}
                  value={category}
                  onChange={onCategoryChange}
                  collapsed={collapsed}
                  onToggleCollapse={toggleCollapse}
                  blueprintCount={blueprintCount}
                />
              </div>
            </aside>

            <div className="min-w-0">
              <div className="mb-4 md:hidden">
                <MobileCategoryNav
                  categories={categories}
                  counts={counts}
                  value={category}
                  onChange={onCategoryChange}
                  collapsed={collapsed}
                  onToggleCollapse={toggleCollapse}
                  blueprintCount={blueprintCount}
                />
              </div>

              {scoped.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-14 text-center">
                  <p className="text-[13px] text-zinc-500">
                    {kw !== "" && inCategory.length > 0
                      ? `没有标题包含「${keyword.trim()}」的工作。`
                      : "这个分类下还没有工作。"}
                  </p>
                  {kw !== "" ? (
                    <Btn className="mt-4" size="sm" variant="ghost" onClick={() => setKeyword("")}>
                      清除搜索
                    </Btn>
                  ) : (
                    <Btn className="mt-4" size="sm" onClick={() => setCreating(true)}>
                      <Plus size={13} weight="bold" />
                      新建工作
                    </Btn>
                  )}
                </div>
              ) : (
                <div className="grid items-start gap-5 md:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {visible.map((col) => (
                      <motion.section
                        key={col.key}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={cn(solo && "md:col-span-2")}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-2">
                          <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
                            <StatusDot status={col.key} />
                            {col.label}
                            <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium tabular-nums text-zinc-500">
                              {byStatus[col.key].length}
                            </span>
                          </span>
                          {col.key === "active" ? (
                            <div className="flex rounded-lg border border-zinc-200/80 bg-white p-0.5">
                              {ORDERS.map((o) => {
                                const Icon = o.icon;
                                return (
                                  <button
                                    key={o.key}
                                    type="button"
                                    onClick={() => setOrder(o.key)}
                                    aria-pressed={order === o.key}
                                    className={cn(
                                      "flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition",
                                      order === o.key
                                        ? "bg-zinc-900 text-zinc-50"
                                        : "text-zinc-500 hover:text-zinc-800",
                                    )}
                                  >
                                    <Icon size={11} weight={order === o.key ? "fill" : "regular"} />
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-400">{col.hint}</span>
                          )}
                        </div>

                        <div
                          className={cn(
                            "mt-3 gap-3",
                            solo ? "grid grid-cols-1 md:grid-cols-2" : "flex flex-col",
                          )}
                        >
                          <AnimatePresence mode="popLayout">
                            {(col.key === "active" ? orderedActive : byStatus[col.key]).map((s, i) => (
                              <WorkCard key={s.work.id} summary={s} index={i} />
                            ))}
                          </AnimatePresence>
                          {byStatus[col.key].length === 0 && (
                            <div className="rounded-xl border border-dashed border-zinc-200 py-9 text-center text-xs text-zinc-300">
                              {kw !== ""
                                ? "没有匹配的工作"
                                : col.key === "active"
                                  ? "还没有在推进的工作"
                                  : "还没有完成的工作"}
                            </div>
                          )}
                        </div>
                      </motion.section>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <NewWorkDialog
        open={creating}
        onClose={() => {
          setCreating(false);
          // 新建的蓝图要立刻出现在蓝图管理页里
          if (blueprintMode) refreshBlueprints();
        }}
        categories={categories}
        defaultCategoryId={typeof category === "number" ? category : null}
        defaultMode={blueprintMode ? "blueprint" : "record"}
      />
      <SettingsDialog
        open={settings}
        onClose={() => setSettings(false)}
        categories={categories}
      />
      <CopyBlueprintDialog
        open={copying != null}
        onClose={() => setCopying(null)}
        onCopied={(id) => {
          setCopying(null);
          router.push(`/work/${id}`);
          router.refresh();
          refreshBlueprints();
        }}
        work={copying}
      />
    </div>
  );
}
