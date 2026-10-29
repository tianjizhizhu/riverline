import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function ForkMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={cn("h-3.5 w-3.5", className)}
      aria-hidden
    >
      <path d="M8 3v5" />
      <path d="M8 8c0 2.2-3.5 1.6-3.5 4.2" />
      <path d="M8 8c0 2.2 3.5 1.6 3.5 4.2" />
      <circle cx="8" cy="2.4" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="13.4" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="13.4" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-zinc-50/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-emerald-400 transition-transform duration-200 group-hover:scale-105">
            <ForkMark />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
              听江声
            </span>
            <span className="hidden text-xs text-zinc-400 sm:inline">
              工作脉络看板
            </span>
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}
