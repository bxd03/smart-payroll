import { env } from "cloudflare:workers";
import { workspaceAccess, ownerClause } from "../../../../lib/workspace-access";
export async function GET(req: Request) {
  const access = workspaceAccess(req, env.SMARTPAYROLL_OWNER_EMAIL);
  if (!access.isSuperadmin) return new Response("Forbidden", { status: 403 });
  const key = new URL(req.url).searchParams.get("workspace");
  if (!key) return new Response("Select workspace", { status: 400 });
  const row = await env
    .DB!.prepare("SELECT data,revision FROM payroll_state WHERE id=?")
    .bind(key)
    .first();

  const files = await env
    .DB!.prepare(
      `SELECT id,name,type,size,created_at,rows FROM source_files WHERE ${ownerClause(key)}`,
    )
    .bind(key)
    .all();
  const audit = await env
    .DB!.prepare(
      `SELECT id,action,actor,detail,created_at FROM audit_events WHERE ${ownerClause(key)} ORDER BY created_at DESC`,
    )
    .bind(key)
    .all();
  return new Response(
    JSON.stringify(
      {
        workspace: key,
        revision: row?.revision || 0,
        data: row ? JSON.parse(row.data as string) : null,
        files: files.results,
        audit: audit.results,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="SmartPayroll-workspace-export.json"',
        "Cache-Control": "no-store",
      },
    },
  );
}
