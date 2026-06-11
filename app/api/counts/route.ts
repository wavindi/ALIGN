import {
  addAudit,
  CountMap,
  isMeasureMatch,
  jsonError,
  jsonErrorFrom,
  numericCount,
  requestIp,
  requireActor,
} from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      referenceId?: string;
      count?: CountMap;
    };
    const actor = await requireActor(body.actor, ["counter", "admin"]);
    const referenceId = body.referenceId?.trim();
    if (!referenceId) {
      return jsonError("Reference is required.");
    }

    const reference = await prisma.inventoryReference.findUnique({ where: { id: referenceId } });
    if (!reference) {
      return jsonError("Reference not found.", 404);
    }
    if (reference.status === "locked") {
      return jsonError("Reference is locked.", 409);
    }
    if (actor.role === "counter" && reference.assignedGroup !== actor.groupName) {
      return jsonError("This reference is assigned to another group.", 403);
    }

    const submittedCount: CountMap = {
      quantity: numericCount(body.count?.quantity),
      volume: numericCount(body.count?.volume),
      weight: numericCount(body.count?.weight),
    };
    const required = reference.requiredMeasures.split(",");
    const missing = required.some((measure) => submittedCount[measure as keyof CountMap] === undefined);
    if (missing) {
      return jsonError("All required count fields must be submitted.");
    }

    const matched = isMeasureMatch(reference, submittedCount);
    const nextAttempt = matched ? Math.max(reference.attempt, 1) : reference.attempt + 1;
    const nextStatus = matched ? "matching" : nextAttempt >= 3 ? "locked" : "discrepancy";

    await prisma.inventoryReference.update({
      where: { id: reference.id },
      data: {
        countQuantity: submittedCount.quantity ?? null,
        countVolume: submittedCount.volume ?? null,
        countWeight: submittedCount.weight ?? null,
        attempt: nextAttempt,
        status: nextStatus,
      },
    });
    await addAudit(
      actor.username,
      `${reference.id} submitted as ${nextStatus} on attempt ${nextAttempt}`,
      nextStatus === "matching" ? "info" : "warning",
      requestIp(request),
    );

    return Response.json({ ok: true, status: nextStatus, attempt: nextAttempt });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to submit count.");
  }
}
