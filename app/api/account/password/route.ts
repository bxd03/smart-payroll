import { pool } from "../../../../lib/server/runtime";
import {
  cookie,
  digest,
  passwordHash,
  passwordMatches,
  sessionCookie,
} from "../../../../lib/server/auth";
import { randomBytes } from "node:crypto";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function account(req: Request) {
  const token = cookie(req, "sp_session");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    await pool().query(
      "SELECT a.* FROM sp_accounts a JOIN sp_sessions s ON a.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
      [digest(token)],
    )
  ).rows[0];
}
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return json({ error: "Forbidden" }, 403);
  try {
    const a = await account(req);
    if (!a) return json({ error: "Please sign in again." }, 401);
    const raw = await req.text();
    if (raw.length > 400000) return json({ error: "Photo is too large." }, 413);
    const body = JSON.parse(raw);
    if (body.action === "password") {
      if (
        typeof body.currentPassword !== "string" ||
        body.currentPassword.length > 128 ||
        typeof body.password !== "string" ||
        body.password.length < 12 ||
        body.password.length > 128
      )
        return json({ error: "Use a new password of 12–128 characters." }, 400);
      const limit = await pool().query(
        `INSERT INTO sp_login_attempts(key,attempts,reset_at) VALUES($1,1,NOW()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN sp_login_attempts.reset_at<NOW() THEN 1 ELSE sp_login_attempts.attempts+1 END,reset_at=CASE WHEN sp_login_attempts.reset_at<NOW() THEN NOW()+interval '15 minutes' ELSE sp_login_attempts.reset_at END RETURNING attempts`,
        ["password:" + a.id],
      );
      if (limit.rows[0].attempts > 5)
        return json({ error: "Too many attempts. Wait 15 minutes." }, 429);
      if (!passwordMatches(body.currentPassword, a.password_hash))
        return json({ error: "Current password is incorrect." }, 400);
      if (passwordMatches(body.password, a.password_hash))
        return json({ error: "Choose a different new password." }, 400);
      const token = randomBytes(32).toString("hex");
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        const changed = await client.query(
          "UPDATE sp_accounts SET password_hash=$1 WHERE id=$2 AND password_hash=$3",
          [passwordHash(body.password), a.id, a.password_hash],
        );
        if (!changed.rowCount) throw new Error("Concurrent password change");
        await client.query("DELETE FROM sp_sessions WHERE user_id=$1", [a.id]);
        await client.query(
          "INSERT INTO sp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+interval '7 days')",
          [digest(token), a.id],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
      return Response.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": sessionCookie(req, token),
          },
        },
      );
    }
    return json({ error: "Invalid action." }, 400);
  } catch {
    return json({ error: "Unable to update password. Please try again." }, 400);
  }
}
