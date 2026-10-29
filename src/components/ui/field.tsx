"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-zinc-700">
          {label}
          {required && <span className="ml-0.5 text-emerald-700">*</span>}
        </span>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-zinc-300/80 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 disabled:bg-zinc-50 disabled:text-zinc-400";

export function TextInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(inputBase, className)} />;
}

export function TextArea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(inputBase, "resize-none leading-relaxed", className)}
    />
  );
}

type BtnVariant = "primary" | "ghost" | "danger" | "soft";

const VARIANTS: Record<BtnVariant, string> = {
  primary:
    "bg-emerald-700 text-white shadow-sm shadow-emerald-900/10 hover:bg-emerald-800",
  ghost:
    "border border-zinc-300/80 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-900",
  danger: "border border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50",
  soft: "border border-emerald-200/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80",
};

export function Btn({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-[13px]",
        VARIANTS[variant],
        className,
      )}
    >
      {loading && (
        <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-600">
      {message}
    </p>
  );
}
