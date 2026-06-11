import { addAudit, jsonError, jsonErrorFrom, requestIp, requireActor } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const groupNames = ["Group A", "Group B", "Group C"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; referenceId?: string };
    const actor = await requireActor(body.actor, ["financier", "admin"]);
    const referenceId = body.referenceId?.trim();
    if (!referenceId) {
      return jsonError("Reference is required.");
    }
    const reference = await prisma.inventoryReference.findUnique({ where: { id: referenceId } });
    if (!reference) {
      return jsonError("Reference not found.", 404);
    }
    const nextGroup = groupNames.find((group) => group !== reference.assignedGroup) ?? "Group A";
    await prisma.inventoryReference.update({
      where: { id: referenceId },
      data: {
        assignedGroup: nextGroup,
        secondGroup: nextGroup,
        status: "pending",
        attempt: 0,
        countQuantity: null,
        countVolume: null,
        countWeight: null,
      },
    });
    await addAudit(actor.username, `${referenceId} reassigned to ${nextGroup} for count again`, "warning", requestIp(request));
    return Response.json({ ok: true, nextGroup });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to reassign reference.");
  }
}
