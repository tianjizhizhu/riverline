import type { Category } from "./types";

export function topCategories(list: Category[]): Category[] {
  return list.filter((c) => c.parentId == null);
}

export function childCategories(list: Category[], parentId: number): Category[] {
  return list.filter((c) => c.parentId === parentId);
}

/** 父分类在前、其子分类紧随其后的展示顺序。 */
export function orderedCategories(list: Category[]): Category[] {
  const out: Category[] = [];
  for (const p of topCategories(list)) {
    out.push(p, ...childCategories(list, p.id));
  }
  return out;
}

/** 分类自身及其子分类的 id 集合，用于筛选时把子分类的工作计入父分类。 */
export function categoryGroupIds(list: Category[], id: number): number[] {
  return [id, ...childCategories(list, id).map((c) => c.id)];
}

/** 分类完整路径，二级显示为「父 / 子」。 */
export function categoryPath(list: Category[], id: number | null): string | null {
  if (id == null) return null;
  const c = list.find((x) => x.id === id);
  if (!c) return null;
  if (c.parentId == null) return c.name;
  const p = list.find((x) => x.id === c.parentId);
  return p ? `${p.name} / ${c.name}` : c.name;
}
