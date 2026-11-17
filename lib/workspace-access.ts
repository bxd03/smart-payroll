export function workspaceAccess(req: Request, ownerEmail?: string) {
  const userId = req.headers.get("oai-authenticated-user-id");
  const email = req.headers.get("oai-authenticated-user-email");
  if (userId && email) {
    return {
      key:
        ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()
          ? "smartpayroll-v2"
          : "user:" + userId,
      actor: email,
      signedIn: true,
      setCookie: "",
    };
  }
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("sp_workspace="))
    ?.slice(13);
  const existing =
    raw &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      raw,
    )
      ? raw
      : undefined;
  const token = existing || crypto.randomUUID();
  return {
    key: "guest:" + token,
    actor: "Guest workspace",
    signedIn: false,
    setCookie: existing
      ? ""
      : `sp_workspace=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
export function ownerClause(key: string) {
  return key === "smartpayroll-v2"
    ? "(owner = ? OR owner IS NULL)"
    : "owner = ?";
}
