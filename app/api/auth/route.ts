import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { pool } from "../../../lib/server/runtime";
import {
  digest,
  passwordHash,
  passwordMatches,
  sessionCookie,
} from "../../../lib/server/auth";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const {
      action,
      email: raw,
      password,
      setupKey,
    } = (await req.json()) as any;
    const email = String(raw || "")
      .trim()
      .toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      return Response.json(
        { error: "Use a valid email and a password of 12–128 characters." },
        { status: 400 },
      );
    const key = digest(
      (req.headers.get("x-nf-client-connection-ip") || "unknown") + ":" + email,
    );
    const limit = await pool().query(
      `INSERT INTO sp_login_attempts(key,attempts,reset_at) VALUES($1,1,NOW()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN sp_login_attempts.reset_at<NOW() THEN 1 ELSE sp_login_attempts.attempts+1 END,reset_at=CASE WHEN sp_login_attempts.reset_at<NOW() THEN NOW()+interval '15 minutes' ELSE sp_login_attempts.reset_at END RETURNING attempts`,
      [key],
    );
    if (limit.rows[0].attempts > 5)
      return Response.json(
        { error: "Too many attempts. Wait 15 minutes." },
        { status: 429 },
      );
    if (action === "register") {
      const owner = process.env.SMARTPAYROLL_OWNER_EMAIL?.toLowerCase();
      if (!owner)
        return Response.json(
          { error: "Owner setup is not configured yet." },
          { status: 503 },
        );
      const isAdmin = email === owner;
      const secret = process.env.SMARTPAYROLL_ADMIN_SETUP_KEY || "";
      const validKey =
        secret.length >= 24 &&
        typeof setupKey === "string" &&
        timingSafeEqual(
          Buffer.from(digest(setupKey)),
          Buffer.from(digest(secret)),
        );
      if (isAdmin && !validKey)
        return Response.json(
          {
            error:
              "The owner account requires the private setup key from Netlify environment variables.",
          },
          { status: 403 },
        );
      await pool().query(
        "INSERT INTO sp_accounts(id,email,password_hash,is_admin) VALUES($1,$2,$3,$4)",
        [randomUUID(), email, passwordHash(password), isAdmin],
      );
    } else if (action !== "login")
      return Response.json({ error: "Invalid action" }, { status: 400 });
    const r = await pool().query(
      "SELECT id,password_hash FROM sp_accounts WHERE email=$1",
      [email],
    );
    const user = r.rows[0];
    // Equal-cost verification for nonexistent accounts.
    const verified = passwordMatches(
      password,
      user?.password_hash ||
        "00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!user || !verified)
      return Response.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    const token = randomBytes(32).toString("hex");
    await pool().query(
      `INSERT INTO sp_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+interval '7 days')`,
      [digest(token), user.id],
    );
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": sessionCookie(req, token),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e: any) {
    console.error("Authentication failed", e.code || "unavailable");
    return Response.json(
      {
        error:
          e.code === "23505"
            ? "That address is already registered. Sign in instead."
            : "Authentication is unavailable. Check database setup.",
      },
      { status: 400 },
    );
  }
}
