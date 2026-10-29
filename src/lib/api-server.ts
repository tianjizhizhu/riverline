import { NextResponse } from "next/server";
import { getCategoryRow, getLineRow, getWorkRow, listNodeRowsByLine } from "./db";
import type { Difficulty, Line, NodeRow, WorkMode } from "./types";

export class ApiFail extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function route(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiFail) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

export function ok<T>(data: T): Response {
  return NextResponse.json(data);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function cleanDate(v: unknown, label: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!DATE_RE.test(s)) throw new ApiFail(`${label}格式应为 YYYY-MM-DD`);
  return s;
}

export function cleanText(
  v: unknown,
  label: string,
  max: number,
  required = false,
): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new ApiFail(`请填写${label}`);
  if (s.length > max) throw new ApiFail(`${label}不超过 ${max} 字`);
  return s;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json();
    if (!data || typeof data !== "object") throw new Error("bad body");
    return data as Record<string, unknown>;
  } catch {
    throw new ApiFail("请求内容格式有误");
  }
}

export function parseId(v: string | undefined, label = "记录"): number {
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) throw new ApiFail(`${label}不存在`, 404);
  return id;
}

const DIFFICULTY_VALUES: Difficulty[] = ["water", "sparkling", "soda"];

export function cleanDifficulty(v: unknown, fallback: Difficulty): Difficulty {
  if (v === undefined || v === null) return fallback;
  const s = typeof v === "string" ? v : "";
  if (!DIFFICULTY_VALUES.includes(s as Difficulty)) {
    throw new ApiFail("任务分级无效");
  }
  return s as Difficulty;
}

export function cleanCategoryId(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) throw new ApiFail("分类不存在");
  if (!getCategoryRow(id)) throw new ApiFail("分类不存在", 404);
  return id;
}

export function cleanCategoryParentId(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) throw new ApiFail("父分类不存在");
  const parent = getCategoryRow(id);
  if (!parent) throw new ApiFail("父分类不存在", 404);
  if (parent.parentId != null) throw new ApiFail("分类最多两级，父分类须为一级分类");
  return id;
}

export function loadLineWithNodes(lineId: number): { line: Line; nodes: NodeRow[] } {
  const line = getLineRow(lineId);
  if (!line) throw new ApiFail("线路不存在", 404);
  return { line, nodes: listNodeRowsByLine(lineId) };
}

const WORK_MODES: WorkMode[] = ["record", "blueprint"];

export function cleanWorkMode(v: unknown, fallback: WorkMode = "record"): WorkMode {
  if (v === undefined || v === null || v === "") return fallback;
  const s = typeof v === "string" ? v : "";
  if (!WORK_MODES.includes(s as WorkMode)) throw new ApiFail("模式无效");
  return s as WorkMode;
}

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
