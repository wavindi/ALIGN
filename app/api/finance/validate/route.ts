import { jsonErrorFrom, requestIp, validateReference } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; referenceId?: string };
    await validateReference(body.actor, body.referenceId, requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to validate reference.");
  }
}
