import { addAudit, ensureSeedData, jsonError, jsonErrorFrom, requestIp, serializeUser, verifyPassword } from "@/lib/align-data";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureSeedData();
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!username || !password) {
      return jsonError("Username and password are required.");
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.locked || !verifyPassword(password, user.passwordHash)) {
      return jsonError("Invalid credentials or locked user.", 401);
    }

    await addAudit(user.username, "Signed in to ALIGN workstation", "info", requestIp(request));
    return Response.json({ user: serializeUser(user) });
  } catch (error) {
    return jsonErrorFrom(error, "Login failed.");
  }
}
