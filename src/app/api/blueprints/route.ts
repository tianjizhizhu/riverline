import { listBlueprintSummaries } from "@/lib/db";
import { ok, route } from "@/lib/api-server";

export async function GET() {
  // 前端 listBlueprints 按 { ok, data } 解析，必须带 data 包装
  return route(async () => ok({ ok: true, data: listBlueprintSummaries() }));
}
