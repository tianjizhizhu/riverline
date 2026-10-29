"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

type PushToast = (message: string, kind?: ToastKind) => void;

const ToastCtx = createContext<PushToast>(() => {});

export function useToast(): PushToast {
  return useContext(ToastCtx);
}

const DOT: Record<ToastKind, string> = {
  success: "bg-emerald-400",
  error: "bg-red-400",
  info: "bg-zinc-400",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback<PushToast>((message, kind = "success") => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-zinc-900 py-2 pl-3.5 pr-4 text-[13px] text-zinc-50 shadow-lg shadow-zinc-950/20"
            >
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[t.kind]}`}
              />
              <span className="truncate">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
