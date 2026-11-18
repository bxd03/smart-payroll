import { pool } from "../../../../lib/server/runtime";
import { cookie, digest, passwordMatches } from "../../../../lib/server/auth";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function identity(req: Request) {
  const token = cookie(req, "sp_session");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = digest(token);
  const r = await pool().query(
    "SELECT a.id,a.password_hash FROM sp_accounts a JOIN sp_sessions s ON a.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
    [hash],
  );
  return r.rows[0] ? { ...r.rows[0], hash } : null;
}
export async function GET(req: Request) {
  try {
    const user = await identity(req);
    if (!user) return json({ error: "Please sign in again." }, 401);
    const r = await pool().query(
      "SELECT expires_at, token_hash=$2 AS current FROM sp_sessions WHERE user_id=$1 AND expires_at>NOW() ORDER BY expires_at DESC",
      [user.id, user.hash],
    );
    return json({ sessions: r.rows });
  } catch {
    return json({ error: "Unable to load sessions." }, 503);
  }
}
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return json({ error: "Forbidden" }, 403);
  try {
    const user = await identity(req);
    if (!user) return json({ error: "Please sign in again." }, 401);
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: "Request too large." }, 413);
    const { password } = JSON.parse(raw);
    if (typeof password !== "string" || password.length > 128)
      return json({ error: "Enter your current password." }, 400);
    const limit = await pool().query(
      `INSERT INTO sp_login_attempts(key,attempts,reset_at) VALUES($1,1,NOW()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN sp_login_attempts.reset_at<NOW() THEN 1 ELSE sp_login_attempts.attempts+1 END,reset_at=CASE WHEN sp_login_attempts.reset_at<NOW() THEN NOW()+interval '15 minutes' ELSE sp_login_attempts.reset_at END RETURNING attempts`,
      ["security:" + user.id],
    );
    if (limit.rows[0].attempts > 5)
      return json({ error: "Too many attempts. Wait 15 minutes." }, 429);
    if (!passwordMatches(password, user.password_hash))
      return json({ error: "Current password is incorrect." }, 400);
    await pool().query(
      "DELETE FROM sp_sessions WHERE user_id=$1 AND token_hash<>$2",
      [user.id, user.hash],
    );
    return json({ ok: true });
  } catch {
    return json({ error: "Unable to end sessions. Try again." }, 400);
  }
}
