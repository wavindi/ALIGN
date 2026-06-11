import { addAudit, hashPassword, jsonError, jsonErrorFrom, requestIp, requireActor, Role } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actor?: string;
      user?: { username?: string; fullName?: string; role?: Role; group?: string };
    };
    const actor = await requireActor(body.actor, ["admin"]);
    const username = body.user?.username?.trim().toLowerCase();
    const fullName = body.user?.fullName?.trim();
    if (!username || !fullName) {
      return jsonError("Username and full name are required.");
    }
    await prisma.user.create({
      data: {
        username,
        fullName,
        role: body.user?.role ?? "counter",
        groupName: body.user?.group ?? "Group A",
        passwordHash: hashPassword("align"),
      },
    });
    await addAudit(actor.username, `Added user ${username}`, "info", requestIp(request));
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
      updates?: { role?: Role; group?: string; locked?: boolean };
    };
    const actor = await requireActor(body.actor, ["admin"]);
    const username = body.username?.trim().toLowerCase();
    if (!username) {
      return jsonError("Username is required.");
    }
    const data: { role?: Role; groupName?: string; locked?: boolean } = {};
    if (body.updates?.role) data.role = body.updates.role;
    if (body.updates?.group) data.groupName = body.updates.group;
    if (typeof body.updates?.locked === "boolean") data.locked = body.updates.locked;
    await prisma.user.update({ where: { username }, data });
    await addAudit(actor.username, `Updated user ${username}`, "info", requestIp(request));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to update user.");
  }
}
