import { addReference, ApiReference, jsonErrorFrom, requestIp, updateReference } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; reference?: ApiReference };
    await addReference(body.actor, body.reference, requestIp(request));
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
    await updateReference(body.actor, body.referenceId, body.updates, requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to update reference.");
  }
}
