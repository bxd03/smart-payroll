import { env } from "cloudflare:workers";
import { workspaceAccess, ownerClause } from "../../../lib/workspace-access";
const allowed = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
export async function POST(req: Request) {
  const access = workspaceAccess(req, env.SMARTPAYROLL_OWNER_EMAIL);
  if (access.setCookie)
    return Response.json(
      { error: "Open the workspace before uploading." },
      { status: 401 },
    );
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin)
      return new Response("Forbidden", { status: 403 });
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File) || file.size > 15 * 1024 * 1024 || !file.size)
      return Response.json(
        { error: "Choose a nonempty file smaller than 15 MB" },
        { status: 400 },
      );
    if (!allowed.includes(file.type) && !/\.(csv|xlsx|xls)$/i.test(file.name))
      return Response.json(
        { error: "Supported: PDF, PNG, JPG, WebP, CSV, XLS and XLSX" },
        { status: 400 },
      );
    const id = crypto.randomUUID(),
      createdAt = new Date().toISOString(),
      name = file.name.replace(/[\r\n"\\/]/g, "_").slice(0, 200);
    await env.BUCKET!.put(id, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    await env
      .DB!.prepare(
        "INSERT INTO source_files(id,name,type,size,created_at,rows,owner) VALUES(?,?,?,?,?,0,?)",
      )
      .bind(id, name, file.type, file.size, createdAt, access.key)
      .run();
    return Response.json({
      id,
      name,
      type: file.type,
      size: file.size,
      createdAt,
      rows: 0,
    });
  } catch {
    return Response.json(
      { error: "Unable to preserve the source file. Try again." },
      { status: 500 },
    );
  }
}
export async function GET(req: Request) {
  const access = workspaceAccess(req, env.SMARTPAYROLL_OWNER_EMAIL);
  if (access.setCookie) return new Response("Not found", { status: 404 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("Missing file ID", { status: 400 });
  const row = await env
    .DB!.prepare(
      `SELECT name,type FROM source_files WHERE id=? AND ${ownerClause(access.key)}`,
    )
    .bind(id, access.key)
    .first();
  if (!row) return new Response("Not found", { status: 404 });
  const file = await env.BUCKET!.get(id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": (row.type as string) || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${row.name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
