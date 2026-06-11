import { jsonError, jsonErrorFrom, loginUser, requestIp } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!username || !password) {
      return jsonError("Username and password are required.");
    }
    const user = await loginUser(username, password, requestIp(request));
    return Response.json({ user });
  } catch (error) {
    return jsonErrorFrom(error, "Login failed.");
  }
}
