import { addAudit, jsonError, jsonErrorFrom, requestIp, requireActor } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; aller?: string; group?: string };
    const actor = await requireActor(body.actor, ["financier", "admin"]);
    const aller = body.aller?.trim().toUpperCase();
    const group = body.group?.trim();
    if (!aller || !group) {
      return jsonError("Aller and assignment group are required.");
    }
    if (!/^Group [A-Z]$/.test(group)) {
      return jsonError("Assignment group must be a counter group.");
    }

    const result = await prisma.inventoryReference.updateMany({
      where: { aller },
      data: { assignedGroup: group },
    });
    await addAudit(actor.username, `${aller} assigned to ${group} by finance`, "info", requestIp(request));
    return Response.json({ ok: true, updated: result.count });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to assign batch.");
  }
}
