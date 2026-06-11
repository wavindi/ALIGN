import { addAudit, ApiReference, jsonError, jsonErrorFrom, measureTypes, requestIp, requireActor } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; references?: ApiReference[]; fileName?: string };
    const actor = await requireActor(body.actor, ["financier", "admin"]);
    const references = Array.isArray(body.references) ? body.references : [];
    if (!references.length) {
      return jsonError("No SAP rows were provided.");
    }

    let imported = 0;
    for (const reference of references) {
      const id = reference.id?.trim().toUpperCase();
      if (!id) {
        continue;
      }
      const required = reference.required.filter((measure) => measureTypes.includes(measure));
      const data = {
        sku: reference.sku?.trim() || id,
        name: reference.name?.trim() || "SAP Material",
        aller: reference.aller?.trim().toUpperCase() || "ALLER-IMPORT",
        assignedGroup: reference.assignedGroup?.trim() || "Group A",
        requiredMeasures: required.length ? required.join(",") : "quantity",
        expectedQuantity: reference.expected.quantity ?? null,
        expectedVolume: reference.expected.volume ?? null,
        expectedWeight: reference.expected.weight ?? null,
      };
      await prisma.inventoryReference.upsert({
        where: { id },
        create: {
          id,
          ...data,
          status: "pending",
          attempt: 0,
        },
        update: data,
      });
      imported += 1;
    }

    await addAudit(actor.username, `Imported SAP file ${body.fileName ?? "upload"} with ${imported} rows`, "info", requestIp(request));
    return Response.json({ ok: true, imported });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to import SAP file.");
  }
}
