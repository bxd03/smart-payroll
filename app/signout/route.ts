import { cookie, digest, sessionCookie } from "../../lib/server/auth";
import { pool } from "../../lib/server/runtime";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return new Response("Forbidden", { status: 403 });
  const token = cookie(req, "sp_session");
  if (token)
    await pool().query("DELETE FROM sp_sessions WHERE token_hash=$1", [
      digest(token),
    ]);
  return new Response(null, {
    status: 303,
    headers: { Location: "/", "Set-Cookie": sessionCookie(req, "", 0) },
  });
}
