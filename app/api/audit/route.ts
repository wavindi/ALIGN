import { addAudit, jsonError, jsonErrorFrom, requestIp, requireActor } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      action?: string;
      severity?: "info" | "warning" | "critical";
    };
    const actor = await requireActor(body.actor, ["counter", "financier", "admin"]);
    if (!body.action?.trim()) {
      return jsonError("Audit action is required.");
    }
    await addAudit(actor.username, body.action.trim(), body.severity ?? "info", requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to write audit entry.");
  }
}
