import { addGroup, jsonErrorFrom, requestIp, updateGroup } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      group?: { name?: string; description?: string; active?: boolean };
    };
    await addGroup(body.actor, body.group, requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to add group.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      name?: string;
      updates?: { description?: string; active?: boolean };
    };
    await updateGroup(body.actor, body.name, body.updates, requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to update group.");
  }
}
