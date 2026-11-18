import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { testDatabase } from "./netlify-db-mock";
import { env, pool } from "../lib/server/runtime";
import { authenticatedRequest } from "../lib/server/auth";
import { POST as auth } from "../app/api/auth/route";
import { POST as importWorkspace } from "../app/api/admin/import/route";
import { GET as workspaces } from "../app/api/admin/workspaces/route";
import {
  GET as getProfile,
  PUT as saveProfile,
} from "../app/api/profile/route";
import { POST as signout } from "../app/signout/route";
import { POST as changePassword } from "../app/api/account/password/route";
import { emptyWorkspace } from "../lib/model";
const origin = "https://payroll.example";
const req = (path: string, body: any, cookie = "") =>
  new Request(origin + path, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
test("Netlify PostgreSQL migration, secure owner setup, sessions, imports and atomic audit", async () => {
  await testDatabase.exec(
    await readFile(
      "netlify/database/migrations/20261117080000_payroll.sql",
      "utf8",
    ),
  );
  await testDatabase.exec(
    await readFile(
      "netlify/database/migrations/20261118090000_profiles.sql",
      "utf8",
    ),
  );
  process.env.SMARTPAYROLL_OWNER_EMAIL = "owner@example.test";
  process.env.SMARTPAYROLL_ADMIN_SETUP_KEY =
    "private-test-key-longer-than-24-characters";
  const forged = new Request(origin + "/api/admin/workspaces", {
    headers: {
      "oai-authenticated-user-id": "owner",
      "oai-authenticated-user-email": "owner@example.test",
    },
  });
  assert.equal((await workspaces(forged)).status, 403);
  assert.equal(
    (
      await auth(
        req("/api/auth", {
          action: "register",
          email: "owner@example.test",
          password: "a-long-password!",
        }),
      )
    ).status,
    403,
  );
  const configuredKey = process.env.SMARTPAYROLL_ADMIN_SETUP_KEY;
  process.env.SMARTPAYROLL_ADMIN_SETUP_KEY = "too-short";
  const shortKey = await auth(
    req("/api/auth", {
      action: "register",
      email: "owner@example.test",
      password: "a-long-password!",
      setupKey: "too-short",
    }),
  );
  assert.equal(shortKey.status, 503);
  assert.match(((await shortKey.json()) as any).error, /at least 24/);
  process.env.SMARTPAYROLL_ADMIN_SETUP_KEY = configuredKey;
  const mismatch = await auth(
    req("/api/auth", {
      action: "register",
      email: "owner@example.test",
      password: "a-long-password!",
      setupKey: "different-private-key-at-least-24-characters",
    }),
  );
  assert.equal(mismatch.status, 403);
  const mismatchBody = await mismatch.text();
  assert.match(mismatchBody, /does not match/);
  assert.equal(mismatchBody.includes(configuredKey!), false);
  const login = await auth(
    req("/api/auth", {
      action: "register",
      email: "owner@example.test",
      password: "a-long-password!",
      setupKey: process.env.SMARTPAYROLL_ADMIN_SETUP_KEY,
    }),
  );
  assert.equal(login.status, 200, await login.clone().text());
  const session = login.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (
      await workspaces(
        new Request(origin + "/api/admin/workspaces", {
          headers: { cookie: session },
        }),
      )
    ).status,
    200,
  );
  const imported = await importWorkspace(
    req(
      "/api/admin/import",
      { workspace: "smartpayroll-v2", data: emptyWorkspace, audit: [] },
      session,
    ),
  );
  assert.equal(imported.status, 200, await imported.clone().text());
  assert.equal(
    (
      await importWorkspace(
        req(
          "/api/admin/import",
          { workspace: "smartpayroll-v2", data: emptyWorkspace },
          session,
        ),
      )
    ).status,
    400,
  );
  const ordinary = await auth(
    req("/api/auth", {
      action: "register",
      email: "staff@example.test",
      password: "another-password!",
    }),
  );
  assert.equal(ordinary.status, 200);
  assert.equal(
    (
      await workspaces(
        new Request(origin + "/api/admin/workspaces", {
          headers: {
            cookie: ordinary.headers.get("set-cookie")!.split(";")[0],
          },
        }),
      )
    ).status,
    403,
  );
  const profileRequest = (
    data: any,
    cookieValue = session,
    requestOrigin = origin,
  ) =>
    new Request(origin + "/api/profile", {
      method: "PUT",
      headers: { origin: requestOrigin, cookie: cookieValue },
      body: JSON.stringify(data),
    });
  const profileData = { displayName: "Badariah", avatar: "", language: "ms" };
  assert.equal(
    (await saveProfile(profileRequest(profileData, ""))).status,
    401,
  );
  assert.equal(
    (
      await saveProfile(
        profileRequest(profileData, session, "https://evil.example"),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await saveProfile(
        profileRequest({
          ...profileData,
          avatar: "data:image/svg+xml;base64,abc",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await saveProfile(
        profileRequest({ ...profileData, language: "unsupported" }),
      )
    ).status,
    400,
  );
  assert.equal((await saveProfile(profileRequest(profileData))).status, 200);
  const ownProfile = (await (
    await getProfile(
      new Request(origin + "/api/profile", { headers: { cookie: session } }),
    )
  ).json()) as any;
  assert.equal(ownProfile.displayName, "Badariah");
  assert.equal(ownProfile.language, "ms");
  assert.equal(ownProfile.password_hash, undefined);
  const otherProfile = (await (
    await getProfile(
      new Request(origin + "/api/profile", {
        headers: { cookie: ordinary.headers.get("set-cookie")!.split(";")[0] },
      }),
    )
  ).json()) as any;
  assert.equal(otherProfile.displayName, "");
  assert.equal(otherProfile.language, "en");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO payroll_state(id,data,revision) VALUES(?,?,0)",
  )
    .bind("test", "{}")
    .run();
  const batch = (rev: number) =>
    env.DB.batch([
      env.DB.prepare(
        "UPDATE payroll_state SET data=?,revision=revision+1 WHERE id=? AND revision=?",
      ).bind('{"saved":true}', "test", rev),
      env.DB.prepare(
        "INSERT INTO audit_events(id,action,actor,detail,created_at,owner) SELECT ?,?,?,?,?,? WHERE changes()=1",
      ).bind(crypto.randomUUID(), "save", "tester", "detail", "now", "test"),
    ]);
  assert.equal((await batch(0))[0].meta.changes, 1);
  assert.equal((await batch(0))[0].meta.changes, 0);
  assert.equal(
    (
      await pool().query(
        "SELECT COUNT(*)::int AS n FROM audit_events WHERE owner='test'",
      )
    ).rows[0].n,
    1,
  );
  await env.BUCKET.put(
    "file",
    new TextEncoder().encode("test document").buffer,
  );
  assert.equal(
    new TextDecoder().decode((await env.BUCKET.get("file"))!.body),
    "test document",
  );
  assert.equal(
    (
      await auth(
        req("/api/auth", {
          action: "login",
          email: "staff@example.test",
          password: "wrong-password!",
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await auth(
        new Request(origin + "/api/auth", {
          method: "POST",
          headers: { origin: "https://evil.example" },
          body: "{}",
        }),
      )
    ).status,
    403,
  );

  const staffSession = ordinary.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (
      await changePassword(
        req("/api/account/password", {
          action: "password",
          currentPassword: "another-password!",
          password: "replacement-password!",
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await changePassword(
        req(
          "/api/account/password",
          {
            action: "password",
            currentPassword: "incorrect",
            password: "replacement-password!",
          },
          staffSession,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await changePassword(
        new Request(origin + "/api/account/password", {
          method: "POST",
          headers: { origin: "https://evil.example", cookie: staffSession },
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  const changed = await changePassword(
    req(
      "/api/account/password",
      {
        action: "password",
        currentPassword: "another-password!",
        password: "replacement-password!",
      },
      staffSession,
    ),
  );
  assert.equal(changed.status, 200, await changed.clone().text());
  assert.equal(
    (
      await authenticatedRequest(
        new Request(origin + "/", { headers: { cookie: staffSession } }),
      )
    ).headers.get("oai-authenticated-user-id"),
    null,
  );
  assert.ok(
    (
      await authenticatedRequest(
        new Request(origin + "/", {
          headers: { cookie: changed.headers.get("set-cookie")!.split(";")[0] },
        }),
      )
    ).headers.get("oai-authenticated-user-id"),
  );
  assert.equal(
    (
      await auth(
        req("/api/auth", {
          action: "login",
          email: "staff@example.test",
          password: "another-password!",
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await auth(
        req("/api/auth", {
          action: "login",
          email: "staff@example.test",
          password: "replacement-password!",
        }),
      )
    ).status,
    200,
  );
  await signout(req("/signout", {}, session));
  assert.equal(
    (
      await authenticatedRequest(
        new Request(origin + "/", { headers: { cookie: session } }),
      )
    ).headers.get("oai-authenticated-user-id"),
    null,
  );
  await testDatabase.close();
});
