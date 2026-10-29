"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const POPOVER_W = 288;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 以周一为一周起点，生成覆盖当前月的 6×7 日格。 */
function monthCells(year: number, month: number) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: { iso: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i);
    cells.push({ iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}

const triggerCls =
  "flex w-full select-none items-center gap-2 rounded-lg border border-zinc-300/80 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/15";
const navCls =
  "flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 active:scale-95";

export function DatePicker({
  value,
  onChange,
  clearable = false,
  placeholder = "选择日期",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  clearable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");
  const [view, setView] = useState(() => {
    const base = parseIso(value || "2000-01-01");
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const openPicker = () => {
    const base = value ? parseIso(value) : new Date();
    setToday(isoOf(base));
    setView({ y: base.getFullYear(), m: base.getMonth() });
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const t = triggerRef.current;
    const p = popRef.current;
    if (!t || !p) return;
    const r = t.getBoundingClientRect();
    const h = p.offsetHeight;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - POPOVER_W - 8);
    const below = window.innerHeight - r.bottom - 12;
    const top = below >= h ? r.bottom + 6 : Math.max(8, r.top - h - 6);
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    // 捕获阶段拦截 Escape，避免同时关掉外层对话框
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const cells = monthCells(view.y, view.m);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={openPicker}
        aria-label={ariaLabel ?? placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(triggerCls, open && "border-emerald-600 ring-2 ring-emerald-600/15")}
      >
        <span
          className={cn(
            "font-mono text-[13px] tabular-nums",
            value ? "text-zinc-900" : "font-sans text-zinc-400",
          )}
        >
          {value || placeholder}
        </span>
        <CalendarBlank size={14} className="ml-auto shrink-0 text-zinc-400" />
      </button>

      {open &&
        createPortal(
          <motion.div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel ?? "选择日期"}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: POPOVER_W }}
            className="z-[60] rounded-xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-950/10"
          >
            <div className="mb-1 flex items-center justify-between px-0.5">
              <button
                type="button"
                aria-label="上个月"
                className={navCls}
                onClick={() =>
                  setView(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
                }
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <span className="text-[13px] font-medium tabular-nums text-zinc-800">
                {view.y} 年 {view.m + 1} 月
              </span>
              <button
                type="button"
                aria-label="下个月"
                className={navCls}
                onClick={() =>
                  setView(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
                }
              >
                <CaretRight size={14} weight="bold" />
              </button>
            </div>

            <div className="mb-0.5 grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="flex h-6 items-center justify-center text-[10.5px] text-zinc-400"
                >
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((c) => {
                const selected = c.iso === value;
                const isToday = c.iso === today;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    aria-pressed={selected}
                    aria-label={c.iso}
                    onClick={() => pick(c.iso)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-lg text-[12.5px] tabular-nums transition active:scale-90",
                      c.inMonth
                        ? "text-zinc-700 hover:bg-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-50",
                      isToday && !selected && "font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/30",
                      selected && "bg-emerald-700 font-medium text-white hover:bg-emerald-800",
                    )}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-1.5 flex items-center justify-between border-t border-zinc-100 pt-1.5">
              <button
                type="button"
                onClick={() => pick(today)}
                className="rounded-md px-2 py-1 text-[11.5px] font-medium text-emerald-800 transition hover:bg-emerald-50 active:scale-95"
              >
                今天
              </button>
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="rounded-md px-2 py-1 text-[11.5px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 active:scale-95"
                >
                  清除
                </button>
              )}
            </div>
          </motion.div>,
          document.body,
        )}
    </>
  );
}
