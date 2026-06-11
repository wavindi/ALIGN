import { assignBatch, jsonErrorFrom, requestIp } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; aller?: string; group?: string };
    const updated = await assignBatch(body.actor, body.aller, body.group, requestIp(request));
    return Response.json({ ok: true, updated });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to assign batch.");
  }
}
