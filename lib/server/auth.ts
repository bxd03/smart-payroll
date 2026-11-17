import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { pool } from "./runtime";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function cookie(req: Request, name: string) {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export async function authenticatedRequest(req: Request) {
  const headers = new Headers(req.headers);
  headers.delete("oai-authenticated-user-id");
  headers.delete("oai-authenticated-user-email");
  const token = cookie(req, "sp_session");
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const r = await pool().query(
      "SELECT a.id,a.email,a.is_admin FROM sp_sessions s JOIN sp_accounts a ON a.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",
      [digest(token)],
    );
    const user = r.rows[0];
    if (user) {
      headers.set("oai-authenticated-user-id", user.id);
      // The reserved owner address can only be created with the private setup key.
      headers.set("oai-authenticated-user-email", !user.is_admin && user.email === process.env.SMARTPAYROLL_OWNER_EMAIL?.toLowerCase() ? "account:" + user.id : user.email);
    }
  }
  return new Request(req, { headers });
}
export function sessionCookie(req: Request, token: string, age = 604800) {
  return `sp_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
