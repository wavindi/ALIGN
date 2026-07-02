import { addUser, jsonErrorFrom, requestIp, Role, updateUser } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      user?: { username?: string; fullName?: string; role?: Role; group?: string };
    };
    await addUser(body.actor, body.user, requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to add user.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      username?: string;
      updates?: { fullName?: string; role?: Role; group?: string; locked?: boolean };
    };
    await updateUser(body.actor, body.username, body.updates, requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to update user.");
  }
}
