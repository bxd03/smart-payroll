import { env } from "cloudflare:workers";
import { workspaceAccess } from "../../../../lib/workspace-access";
export async function GET(req: Request) {
  const access = workspaceAccess(req, env.SMARTPAYROLL_OWNER_EMAIL);
  if (!access.isSuperadmin)
    return Response.json(
      { error: "Superadmin access required" },
      { status: 403 },
    );
  const rows = await env
    .DB!.prepare("SELECT id,data,revision FROM payroll_state ORDER BY id")
    .all();
  const fileOwners = await env
    .DB!.prepare(
      "SELECT owner,COUNT(*) AS count FROM source_files GROUP BY owner",
    )
    .all();
  const existing = new Set(rows.results.map((r: any) => r.id));
  for (const f of fileOwners.results as any[]) {
    const id = f.owner || "smartpayroll-v2";
    if (!existing.has(id)) {
      rows.results.push({
        id,
        data: JSON.stringify({
          version: 2,
          companies: [],
          workers: [],
          attendance: [],
          runs: [],
        }),
        revision: 0,
      });
      existing.add(id);
    }
  }
  const items = rows.results.map((r: any) => {
    const s = JSON.parse(r.data);
    return {
      key: r.id,
      label:
        r.id === "smartpayroll-v2"
          ? "Your original workspace"
          : r.id.startsWith("guest:")
            ? "Guest workspace · " + r.id.slice(-8)
            : r.id.startsWith("user:")
              ? "Account workspace · " + r.id.slice(-8)
              : "Legacy workspace · " + r.id,
      version: s?.version || 1,
      companies: s?.companies?.length || 0,
      workers: s?.workers?.length || 0,
      attendance: s?.attendance?.length || 0,
      payroll: s?.runs?.length || 0,
      revision: r.revision,
      files: fileOwners.results
        .filter((f: any) => (f.owner || "smartpayroll-v2") === r.id)
        .reduce((n: number, f: any) => n + f.count, 0),
    };
  });
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
