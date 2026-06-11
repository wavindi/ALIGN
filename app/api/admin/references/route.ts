import { addAudit, ApiReference, jsonError, jsonErrorFrom, measureTypes, requestIp, requireActor } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; reference?: ApiReference };
    const actor = await requireActor(body.actor, ["admin"]);
    const reference = body.reference;
    const id = reference?.id?.trim().toUpperCase();
    if (!reference || !id || !reference.name?.trim()) {
      return jsonError("Reference and name are required.");
    }
    const required = reference.required.filter((measure) => measureTypes.includes(measure));
    if (!required.length) {
      return jsonError("At least one measure is required.");
    }
    await prisma.inventoryReference.create({
      data: {
        id,
        sku: reference.sku?.trim() || id,
        name: reference.name.trim(),
        aller: reference.aller?.trim().toUpperCase() || "ALLER-01",
        assignedGroup: reference.assignedGroup || "Group A",
        requiredMeasures: required.join(","),
        expectedQuantity: reference.expected.quantity ?? null,
        expectedVolume: reference.expected.volume ?? null,
        expectedWeight: reference.expected.weight ?? null,
        status: "pending",
        attempt: 0,
      },
    });
    await addAudit(actor.username, `Added reference ${id}`, "info", requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to add reference.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      referenceId?: string;
      updates?: { status?: string; attempt?: number };
    };
    const actor = await requireActor(body.actor, ["admin"]);
    const id = body.referenceId?.trim().toUpperCase();
    if (!id) {
      return jsonError("Reference ID is required.");
    }

    const data: { status?: string; attempt?: number; secondGroup?: string | null } = {};
    const allowedStatuses = ["pending", "matching", "discrepancy", "locked", "validated"];
    if (body.updates?.status && allowedStatuses.includes(body.updates.status)) {
      data.status = body.updates.status;
      if (body.updates.status === "pending") {
        data.secondGroup = null;
      }
    }
    if (typeof body.updates?.attempt === "number") {
      data.attempt = Math.max(0, Math.min(3, Math.trunc(body.updates.attempt)));
    }
    if (!Object.keys(data).length) {
      return jsonError("No reference updates were provided.");
    }

    await prisma.inventoryReference.update({ where: { id }, data });
    await addAudit(actor.username, `Updated reference ${id} from admin override`, "warning", requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to update reference.");
  }
}
