import { ApiReference, importReferences, jsonErrorFrom, requestIp } from "@/lib/align-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { actor?: string; references?: ApiReference[]; fileName?: string };
    const references = Array.isArray(body.references) ? body.references : [];
    const imported = await importReferences(body.actor, references, body.fileName, requestIp(request));
    return Response.json({ ok: true, imported });
  } catch (error) {
    return jsonErrorFrom(error, "Unable to import SAP file.");
  }
}
