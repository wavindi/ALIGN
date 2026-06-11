import { addAudit, jsonErrorFrom, requestIp, requireActor } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string };
    const actor = await requireActor(body.actor, ["admin"]);
    await prisma.inventoryReference.updateMany({
      data: {
        status: "pending",
        attempt: 0,
        countQuantity: null,
        countVolume: null,
        countWeight: null,
        secondGroup: null,
      },
    });
    await addAudit(actor.username, "Day reset completed and temporary locks cleared", "critical", requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to reset day.");
  }
}
