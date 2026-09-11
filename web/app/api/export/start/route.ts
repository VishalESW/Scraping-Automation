import { startExportJob } from "@/lib/export-jobs";
import type { ExportType } from "@/lib/exporters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: ExportType[] = ["seller-map", "subcategory", "brand"];

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const type = body?.type as ExportType;
  if (!VALID.includes(type)) {
    return Response.json({ error: "Invalid export type", status: 400 }, { status: 400 });
  }
  const payload = (body?.payload ?? {}) as Record<string, unknown>;
  const id = startExportJob(type, payload);
  return Response.json({ id });
}
