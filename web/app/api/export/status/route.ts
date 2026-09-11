import { getExportJob } from "@/lib/export-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const job = getExportJob(id);
  if (!job) {
    return Response.json({ status: "expired", error: "Export not found or expired. Please run it again." });
  }
  if (job.status === "error") {
    return Response.json({
      status: "error",
      error: job.error?.error ?? "Export failed",
      statusCode: job.error?.status ?? 500,
      tokenExpired: job.error?.tokenExpired ?? false,
    });
  }
  if (job.status === "done") {
    return Response.json({ status: "done", filename: job.filename });
  }
  return Response.json({ status: "pending" });
}
