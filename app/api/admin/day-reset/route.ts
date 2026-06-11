import { jsonErrorFrom, requestIp, resetDay } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string };
    await resetDay(body.actor, requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to reset day.");
  }
}
