import { getAppState, jsonErrorFrom } from "@/lib/align-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getAppState());
  } catch (error) {
    return jsonErrorFrom(error, "Unable to load app state.");
  }
}
