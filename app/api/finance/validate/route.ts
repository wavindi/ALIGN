import { addAudit, jsonError, jsonErrorFrom, requestIp, requireActor } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; referenceId?: string };
    const actor = await requireActor(body.actor, ["financier", "admin"]);
    const referenceId = body.referenceId?.trim();
    if (!referenceId) {
      return jsonError("Reference is required.");
    }
    await prisma.inventoryReference.update({
      where: { id: referenceId },
      data: { status: "validated" },
    });
    await addAudit(actor.username, `${referenceId} validated by finance controller`, "info", requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to validate reference.");
  }
}
