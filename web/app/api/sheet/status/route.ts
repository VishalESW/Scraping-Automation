import { getSheetJob } from "@/lib/sheet-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id is required", status: 400 }, { status: 400 });
  const job = getSheetJob(id);
  if (!job) return Response.json({ status: "expired" });
  return Response.json({
    status: job.status,
    progress: job.progress,
    error: job.error?.error,
    statusCode: job.error?.status,
    tokenExpired: job.error?.tokenExpired,
  });
}
