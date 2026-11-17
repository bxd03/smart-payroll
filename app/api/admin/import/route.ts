import { authenticatedRequest } from "../../../../lib/server/auth";
import { pool } from "../../../../lib/server/runtime";
import { workspaceAccess } from "../../../../lib/workspace-access";
export async function POST(req: Request) {
  req = await authenticatedRequest(req);
  const access = workspaceAccess(req, process.env.SMARTPAYROLL_OWNER_EMAIL);
  if (!access.isSuperadmin)
    return Response.json(
      { error: "Superadmin access required" },
      { status: 403 },
    );
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const text = await req.text();
  if (text.length > 2000000)
    return Response.json(
      {
        error:
          "Export exceeds 2 MB. Contact the project administrator for a larger migration.",
      },
      { status: 413 },
    );
  try {
    const value = JSON.parse(text);
    if (
      typeof value.workspace !== "string" ||
      value.workspace.length > 200 ||
      value.data?.version !== 2 ||
      ![
        "companies",
        "workers",
        "shifts",
        "attendance",
        "runs",
        "sites",
      ].every((k) => Array.isArray(value.data[k]))
    )
      throw Error(
        "Use a version 2 workspace export from the previous SmartPayroll site.",
      );
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      // Atomic insert only: this import cannot replace any workspace that already has records.
      const added = await client.query(
        "INSERT INTO payroll_state(id,data,revision) VALUES($1,$2,1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,revision=1 WHERE payroll_state.revision=0 RETURNING id",
        [value.workspace, JSON.stringify(value.data)],
      );
      if (!added.rowCount)
        throw Error(
          "This workspace already has saved data. Import stopped to prevent overwriting it.",
        );
      for (const a of value.audit || [])
        await client.query(
          "INSERT INTO audit_events(id,action,actor,detail,created_at,owner) VALUES($1,$2,$3,$4,$5,$6)",
          [
            crypto.randomUUID(),
            String(a.action),
            String(a.actor),
            String(a.detail),
            String(a.created_at),
            value.workspace,
          ],
        );
      await client.query(
        "INSERT INTO audit_events(id,action,actor,detail,created_at,owner) VALUES($1,$2,$3,$4,$5,$6)",
        [
          crypto.randomUUID(),
          "migration",
          access.actor,
          "Imported workspace JSON; original attachment binaries remain on previous host.",
          new Date().toISOString(),
          value.workspace,
        ],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return Response.json({
      ok: true,
      workspace: value.workspace,
      notice:
        "Workspace and audit imported. Original attachment files remain on the previous host; download and archive those separately.",
    });
  } catch (e: any) {
    return Response.json(
      { error: e.message || "Import failed" },
      { status: 400 },
    );
  }
}
