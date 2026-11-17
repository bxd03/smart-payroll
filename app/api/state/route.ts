import { env } from "cloudflare:workers";
import { emptyWorkspace } from "../../../lib/model";
import { mutate } from "../../../lib/service";
import { workspaceAccess, ownerClause } from "../../../lib/workspace-access";
const json = (v: any, status = 200) =>
  Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: Request) {
  const access = workspaceAccess(req, env.SMARTPAYROLL_OWNER_EMAIL);
  const key = access.key;
  try {
    const db = env.DB!;
    const row = await db
      .prepare("SELECT data,revision FROM payroll_state WHERE id=?")
      .bind(key)
      .first();
    const files = await db
      .prepare(
        `SELECT id,name,type,size,created_at AS createdAt,rows FROM source_files WHERE ${ownerClause(key)} ORDER BY created_at DESC LIMIT 200`,
      )
      .bind(key)
      .all();
    const audit = await db
      .prepare(
        `SELECT id,action,actor,detail,created_at AS createdAt FROM audit_events WHERE ${ownerClause(key)} ORDER BY created_at DESC LIMIT 200`,
      )
      .bind(key)
      .all();
    const response = json({
      workspace: {
        signedIn: access.signedIn,
        name: access.signedIn ? "My workspace" : "Guest workspace",
      },
      data: row ? JSON.parse(row.data as string) : emptyWorkspace,
      revision: row?.revision || 0,
      files: files.results,
      audit: audit.results,
    });
    if (access.setCookie) response.headers.set("Set-Cookie", access.setCookie);
    return response;
  } catch (e) {
    console.error(e);
    return json({ error: "Could not load workspace. Please try again." }, 500);
  }
}
export async function POST(req: Request) {
  const access = workspaceAccess(req, env.SMARTPAYROLL_OWNER_EMAIL);
  const key = access.key;
  if (access.setCookie)
    return json({ error: "Open the workspace before saving records." }, 401);
  try {
    if (req.headers.get("origin") !== new URL(req.url).origin)
      return json({ error: "Request origin is not allowed" }, 403);
    if (Number(req.headers.get("content-length") || 0) > 2000000)
      return json({ error: "Request too large" }, 413);
    const { action, payload, revision } = (await req.json()) as any;
    if (!Number.isInteger(revision))
      return json({ error: "Invalid revision" }, 400);
    const db = env.DB!;
    await db
      .prepare(
        "INSERT OR IGNORE INTO payroll_state(id,data,revision) VALUES(?,?,0)",
      )
      .bind(key, JSON.stringify(emptyWorkspace))
      .run();
    const row = await db
      .prepare("SELECT data,revision FROM payroll_state WHERE id=?")
      .bind(key)
      .first();
    if (row?.revision !== revision)
      return json(
        {
          error:
            "Another tab changed the records. Reload the workspace, then try again.",
        },
        409,
      );
    const actor = access.actor;
    if (payload?.sourceId || payload?.value?.sourceId) {
      const sourceId = payload.sourceId || payload.value.sourceId;
      const owned = await db
        .prepare(
          `SELECT id FROM source_files WHERE id=? AND ${ownerClause(key)}`,
        )
        .bind(sourceId, key)
        .first();
      if (!owned)
        return json({ error: "Source file not found in this workspace" }, 404);
    }
    const { state, detail, result } = mutate(
      JSON.parse(row!.data as string),
      action,
      payload,
      actor,
    );
    const auditId = crypto.randomUUID(),
      now = new Date().toISOString();
    const results = await db.batch([
      db
        .prepare(
          "UPDATE payroll_state SET data=?,revision=revision+1 WHERE id=? AND revision=?",
        )
        .bind(JSON.stringify(state), key, revision),
      db
        .prepare(
          "INSERT INTO audit_events(id,action,actor,detail,created_at,owner) SELECT ?,?,?,?,?,? WHERE changes()=1",
        )
        .bind(auditId, action, actor, detail, now, key),
    ]);
    if (!results[0].meta.changes)
      return json(
        { error: "Records changed while saving. Reload and try again." },
        409,
      );
    if (action === "importAttendance" && result?.sourceId)
      await db
        .prepare("UPDATE source_files SET rows=rows+? WHERE id=?")
        .bind(result.imported, result.sourceId)
        .run();
    return json({
      data: state,
      revision: revision + 1,
      result,
      auditEvent: { id: auditId, action, actor, detail, createdAt: now },
    });
  } catch (e: any) {
    const message =
      e?.issues
        ?.map((x: any) => `${x.path.join(".")}: ${x.message}`)
        .join("; ") ||
      e.message ||
      "Unable to save";
    return json({ error: message }, 400);
  }
}
