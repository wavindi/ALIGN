import { countAgainReference, jsonErrorFrom, requestIp } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; referenceId?: string };
    const nextGroup = await countAgainReference(body.actor, body.referenceId, requestIp(request));
    return Response.json({ ok: true, nextGroup });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to reassign reference.");
  }
}
