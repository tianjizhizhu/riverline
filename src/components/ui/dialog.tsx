"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Btn } from "./field";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
  size,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  /** xl：蓝图查看器等需要接近版面宽度的大弹窗 */
  size?: "xl";
  /** 尺寸类之外的补充（如固定高度），仅传不与其他尺寸类冲突的部分 */
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/25 backdrop-blur-[3px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className={cn(
              "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-950/10",
              size === "xl" ? "max-w-[1080px]" : wide ? "max-w-lg" : "max-w-md",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 active:scale-95"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            {/* 内容区独立滚动：弹窗头固定，滚动条隐藏，支持手势/滚轮 */}
            <div className="scroll-none flex-1 overflow-y-auto px-5 pb-5 pt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "确认",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="mt-1 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose} size="sm">
          取消
        </Btn>
        <Btn
          variant={danger ? "danger" : "primary"}
          onClick={run}
          loading={loading}
          size="sm"
        >
          {confirmLabel}
        </Btn>
      </div>
    </Dialog>
  );
}
