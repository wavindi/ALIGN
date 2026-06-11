import {
  CountMap,
  jsonErrorFrom,
  requestIp,
  submitReferenceCount,
} from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      referenceId?: string;
      count?: CountMap;
    };
    const result = await submitReferenceCount(body.actor, body.referenceId, body.count, requestIp(request));

    return Response.json({ ok: true, status: result.status, attempt: result.attempt });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to submit count.");
  }
}
