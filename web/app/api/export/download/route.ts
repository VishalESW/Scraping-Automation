import { getExportJob } from "@/lib/export-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const job = getExportJob(id);
  if (!job || job.status !== "done" || !job.data) {
    return Response.json({ error: "Export not ready or expired.", status: 404 }, { status: 404 });
  }
  return new Response(new Uint8Array(job.data), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${job.filename ?? "export.xlsx"}"`,
      "Cache-Control": "no-store",
    },
  });
}
