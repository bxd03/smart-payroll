import { authenticatedRequest } from "../../../lib/server/auth";
import { pool } from "../../../lib/server/runtime";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
async function accountId(req: Request) {
  return (
    await authenticatedRequest(new Request(req.url, { headers: req.headers }))
  ).headers.get("oai-authenticated-user-id");
}
export async function GET(req: Request) {
  const id = await accountId(req);
  if (!id)
    return Response.json(
      { error: "Sign in to manage your profile." },
      { status: 401, headers },
    );
  const result = await pool().query(
    'SELECT email, display_name AS "displayName", avatar, language FROM sp_accounts WHERE id=$1',
    [id],
  );
  return Response.json(result.rows[0], { headers });
}
export async function PUT(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const id = await accountId(req);
  if (!id)
    return Response.json(
      { error: "Sign in to manage your profile." },
      { status: 401, headers },
    );
  const body = await req.text();
  if (body.length > 400000)
    return Response.json(
      { error: "Profile image is too large." },
      { status: 413 },
    );
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid profile." }, { status: 400 });
  }
  if (
    !data ||
    typeof data.displayName !== "string" ||
    !data.displayName.trim() ||
    data.displayName.trim().length > 80 ||
    !["en", "ms"].includes(data.language) ||
    typeof data.avatar !== "string"
  )
    return Response.json(
      { error: "Enter a name of 1–80 characters and a supported language." },
      { status: 400 },
    );
  if (data.avatar) {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      data.avatar,
    );
    const bytes = match ? Buffer.from(match[1], "base64") : null;
    if (
      !bytes ||
      bytes.length > 280000 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[2] !== 255
    )
      return Response.json(
        { error: "Choose a valid profile photo." },
        { status: 400 },
      );
  }
  const result = await pool().query(
    'UPDATE sp_accounts SET display_name=$1, avatar=$2, language=$3 WHERE id=$4 RETURNING email, display_name AS "displayName", avatar, language',
    [data.displayName.trim(), data.avatar, data.language, id],
  );
  return Response.json(result.rows[0], { headers });
}
