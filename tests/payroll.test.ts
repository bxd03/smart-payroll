import test from "node:test";
import assert from "node:assert/strict";
import { calculate, clock, isLocked, blockingIssues } from "../lib/engine";
import { defaultPolicy, emptyWorkspace } from "../lib/model";
import { makeDemo, mutate } from "../lib/service";
import {
  tableRows,
  textRows,
  validateImport,
  normalTime,
} from "../lib/importer";
const base = {
  clockIn: "07:33",
  clockOut: "19:27",
  shiftStart: "07:30",
  shiftEnd: "19:30",
  breakMinutes: 60,
  rate: 10,
  policy: defaultPolicy,
};
test("proposal tolerance examples and exact five-minute boundaries", () => {
  for (const [cin, cout, ain, aout, hours] of [
    ["07:30", "19:30", "07:30", "19:30", 11],
    ["07:33", "19:27", "07:30", "19:30", 11],
    ["07:35", "19:25", "07:30", "19:30", 11],
    ["07:36", "19:20", "08:00", "19:00", 10],
    ["07:45", "19:30", "08:00", "19:30", 10.5],
    ["07:30", "19:24", "07:30", "19:00", 10.5],
  ] as const) {
    const c = calculate({ ...base, clockIn: cin, clockOut: cout });
    assert.equal(clock(c.adjustedIn), ain);
    assert.equal(clock(c.adjustedOut), aout);
    assert.equal(c.hours, hours);
  }
});
test("overtime, wage precision, and break deduction", () => {
  const c = calculate(base);
  assert.equal(c.regularHours, 8);
  assert.equal(c.otHours, 3);
  assert.equal(c.regularPay, 80);
  assert.equal(c.otPay, 45);
  assert.equal(c.total, 125);
});
test("overnight shift and outside shift policy", () => {
  assert.equal(
    calculate({
      ...base,
      shiftStart: "19:30",
      shiftEnd: "07:30",
      clockIn: "19:33",
      clockOut: "07:27",
    }).hours,
    11,
  );
  assert.equal(
    calculate({ ...base, clockIn: "07:00", clockOut: "20:00" }).hours,
    11,
  );
  assert.equal(
    calculate({
      ...base,
      clockIn: "07:00",
      clockOut: "20:00",
      policy: { ...defaultPolicy, outsideShift: true },
    }).hours,
    12,
  );
});
test("missing punches, zero duration, excessive break and unusual hours", () => {
  assert.ok(
    calculate({ ...base, clockOut: "" }).errors.includes(
      "Missing clock-in or clock-out",
    ),
  );
  assert.ok(
    calculate({ ...base, clockIn: "07:30", clockOut: "07:30" }).errors.includes(
      "Clock-in and clock-out are identical",
    ),
  );
  assert.ok(
    calculate({ ...base, breakMinutes: 800 }).errors.includes(
      "Break exceeds working duration",
    ),
  );
  assert.ok(
    calculate({
      ...base,
      policy: { ...defaultPolicy, maxHours: 10 },
    }).errors.includes("Unusual working hours"),
  );
});
test("server rejects duplicates and invalid calendar dates", () => {
  const s = makeDemo(),
    a = s.attendance[0];
  assert.throws(
    () =>
      mutate(
        s,
        "saveEntity",
        { entity: "attendance", value: { ...a, id: "duplicate" } },
        "test",
      ),
    /Duplicate/,
  );
  assert.throws(() =>
    mutate(
      s,
      "saveEntity",
      { entity: "attendance", value: { ...a, id: "bad", date: "2026-02-30" } },
      "test",
    ),
  );
});
test("editing retains original punches and saved policy / rate", () => {
  const s = makeDemo(),
    a = s.attendance[0];
  s.companies[0].policy.grace = 0;
  s.workers[0].rate = 99;
  const next = mutate(
    s,
    "saveEntity",
    { entity: "attendance", value: { ...a, clockIn: "07:45" } },
    "test",
  ).state;
  const saved = next.attendance.find((x) => x.id === a.id)!;
  assert.equal(saved.original.clockIn, a.clockIn);
  assert.equal(saved.policy.grace, 5);
  assert.equal(saved.rate, a.rate);
});
test("draft approval blocks unresolved issues; finalization locks records and payment is explicit", () => {
  let s = makeDemo();
  const companyId = s.companies[1].id,
    a = s.attendance.find((a) => a.companyId === companyId)!;
  s = mutate(
    s,
    "createRun",
    {
      companyId,
      start: a.date.slice(0, 7) + "-01",
      end: a.date.slice(0, 7) + "-28",
    },
    "reviewer@example.com",
  ).state;
  const r = s.runs[0];
  s = mutate(
    s,
    "updateRunRow",
    {
      id: r.id,
      workerId: r.rows[0].workerId,
      allowance: 25,
      deduction: 5,
      adjustmentNote: "Transport allowance and verified advance",
    },
    "reviewer@example.com",
  ).state;
  assert.equal(s.runs[0].rows[0].net, r.rows[0].net + 20);
  s = mutate(s, "finalizeRun", { id: r.id }, "reviewer@example.com").state;
  assert.equal(s.runs[0].status, "Finalized");
  assert.ok(isLocked(s, a));
  assert.throws(
    () =>
      mutate(
        s,
        "saveEntity",
        { entity: "attendance", value: { ...a, date: "2026-12-30" } },
        "test",
      ),
    /Finalized attendance cannot/,
  );
  assert.throws(
    () => mutate(s, "updateRunRow", { id: r.id }, "test"),
    /Only draft/,
  );
  assert.throws(() =>
    mutate(s, "payRun", { id: r.id, paymentReference: "" }, "test"),
  );
  s = mutate(
    s,
    "payRun",
    { id: r.id, paymentReference: "BANK-REF-001" },
    "test",
  ).state;
  assert.equal(s.runs[0].status, "Paid");
  assert.equal(s.runs[0].paymentReference, "BANK-REF-001");
});
test("changed attendance makes draft stale; refresh recalculates and resets adjustments", () => {
  let s = makeDemo(),
    a = s.attendance.find((a) => a.companyId === s.companies[1].id)!;
  s = mutate(
    s,
    "createRun",
    {
      companyId: a.companyId,
      start: a.date.slice(0, 7) + "-01",
      end: a.date.slice(0, 7) + "-28",
    },
    "test",
  ).state;
  const id = s.runs[0].id;
  s = mutate(
    s,
    "saveEntity",
    { entity: "attendance", value: { ...a, clockIn: "20:00" } },
    "test",
  ).state;
  assert.throws(
    () => mutate(s, "finalizeRun", { id }, "test"),
    /Attendance changed/,
  );
  s = mutate(s, "refreshRun", { id }, "test").state;
  assert.doesNotThrow(() => mutate(s, "finalizeRun", { id }, "test"));
});
test("missing clock blocks payroll and excessive deductions are rejected", () => {
  let s = makeDemo();
  const a = s.attendance[0];
  s = mutate(
    s,
    "createRun",
    {
      companyId: a.companyId,
      start: a.date.slice(0, 7) + "-01",
      end: a.date.slice(0, 7) + "-28",
    },
    "test",
  ).state;
  const r = s.runs[0];
  assert.throws(
    () => mutate(s, "finalizeRun", { id: r.id }, "test"),
    /attendance issue/,
  );
  assert.throws(
    () =>
      mutate(
        s,
        "updateRunRow",
        {
          id: r.id,
          workerId: r.rows[0].workerId,
          allowance: 0,
          deduction: 99999,
          adjustmentNote: "Invalid",
        },
        "test",
      ),
    /exceed/,
  );
});
test("company links prevent cross-company attendance", () => {
  const s = makeDemo(),
    a = s.attendance[0];
  assert.throws(
    () =>
      mutate(
        s,
        "saveEntity",
        { entity: "attendance", value: { ...a, workerId: s.workers[7].id } },
        "test",
      ),
    /Worker must belong/,
  );
});
test("spreadsheet and OCR row mapping, times and import duplicates", () => {
  const rows = tableRows(
    [
      ["Worker ID", "Date", "Clock In", "Clock Out", "Break Minutes"],
      ["TW-001", "17/11/2026", "7:33 AM", "7:27 PM", 60],
    ],
    0,
  );
  assert.equal(rows[0].clockOut, "19:27");
  assert.equal(rows[0].date, "2026-11-17");
  assert.equal(normalTime(0.5), "12:00");
  const text = textRows("TW-001 2026-11-17 07:33 19:27", 60);
  assert.equal(text[0].workerCode, "TW-001");
  const s = makeDemo();
  assert.ok(
    validateImport([...rows, ...rows], s, s.companies[0].id)[1].issues.includes(
      "Duplicate attendance",
    ),
  );
});

import { workspaceAccess, ownerClause } from "../lib/workspace-access";
test("anonymous visitors receive separate opaque workspaces and secure cookies", () => {
  const a = workspaceAccess(new Request("https://payroll.test/api/state"));
  const b = workspaceAccess(new Request("https://payroll.test/api/state"));
  assert.notEqual(a.key, b.key);
  assert.ok(a.setCookie.includes("HttpOnly; SameSite=Lax"));
  assert.ok(a.setCookie.includes("; Secure"));
  const cookie = a.setCookie.split(";")[0];
  const again = workspaceAccess(
    new Request("https://payroll.test/api/state", { headers: { cookie } }),
  );
  assert.equal(a.key, again.key);
  assert.equal(again.setCookie, "");
});
test("forged guest cookie cannot select owner or signed-in workspace", () => {
  for (const value of ["smartpayroll-v2", "user:owner", "../../owner", "123"]) {
    const a = workspaceAccess(
      new Request("https://payroll.test", {
        headers: { cookie: "sp_workspace=" + value },
      }),
    );
    assert.ok(a.key.startsWith("guest:"));
    assert.ok(a.setCookie);
  }
});
test("signed-in owner retains legacy records; other identities are separate", () => {
  const request = (id: string, email: string) =>
    new Request("https://payroll.test", {
      headers: {
        "oai-authenticated-user-id": id,
        "oai-authenticated-user-email": email,
      },
    });
  assert.equal(
    workspaceAccess(request("owner", "owner@example.com"), "owner@example.com")
      .key,
    "smartpayroll-v2",
  );
  assert.equal(
    workspaceAccess(request("other", "other@example.com"), "owner@example.com")
      .key,
    "user:other",
  );
  assert.equal(
    workspaceAccess(request("owner", "owner@example.com")).key,
    "user:owner",
  );
  assert.equal(ownerClause("guest:123"), "owner = ?");
  assert.ok(ownerClause("smartpayroll-v2").includes("owner IS NULL"));
});

import { selectedWorkspaceAccess } from "../lib/workspace-access";
test("only configured signed-in owner can select other workspaces", () => {
  const url = "https://payroll.test/api/state?workspace=guest%3Atarget";
  assert.equal(
    selectedWorkspaceAccess(new Request(url), "owner@example.com").denied,
    true,
  );
  const other = new Request(url, {
    headers: {
      "oai-authenticated-user-id": "other",
      "oai-authenticated-user-email": "other@example.com",
    },
  });
  assert.equal(
    selectedWorkspaceAccess(other, "owner@example.com").denied,
    true,
  );
  const owner = new Request(url, {
    headers: {
      "oai-authenticated-user-id": "owner",
      "oai-authenticated-user-email": "owner@example.com",
    },
  });
  const access = selectedWorkspaceAccess(owner, "owner@example.com");
  assert.equal(access.denied, false);
  assert.equal(access.isSuperadmin, true);
  assert.equal(access.key, "guest:target");
  assert.equal(
    workspaceAccess(
      new Request("https://payroll.test?isSuperadmin=true"),
      "owner@example.com",
    ).isSuperadmin,
    false,
  );
});
test("worker deletion is restorable and preserves attendance and payroll inputs", () => {
  let s = makeDemo();
  const w = s.workers[0],
    count = s.attendance.length;
  s = mutate(s, "deleteWorker", { id: w.id }, "test").state;
  assert.ok(s.workers[0].deletedAt);
  assert.equal(s.workers[0].status, "Inactive");
  assert.equal(s.attendance.length, count);
  const old = s.attendance[0];
  s = mutate(
    s,
    "saveEntity",
    { entity: "attendance", value: { ...old, clockOut: "19:00" } },
    "test",
  ).state;
  assert.equal(s.attendance[0].original.clockOut, old.clockOut);
  assert.throws(
    () =>
      mutate(
        s,
        "saveEntity",
        {
          entity: "attendance",
          value: { ...old, id: crypto.randomUUID(), date: "2026-12-31" },
        },
        "test",
      ),
    /Restore/,
  );
  s = mutate(s, "restoreWorker", { id: w.id }, "test").state;
  assert.equal(s.workers[0].deletedAt, undefined);
  assert.equal(s.workers[0].status, "Active");
});
test("manual punch intervals work without an assigned shift", () => {
  const s = makeDemo(),
    w = s.workers[0];
  const value = {
    id: crypto.randomUUID(),
    companyId: w.companyId,
    workerId: w.id,
    siteId: w.siteId,
    shiftId: "",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    date: "2026-12-20",
    clockIn: "08:00",
    clockOut: "17:00",
    breakMinutes: 60,
    notes: "Manual interval",
    reviewNote: "",
    sourceId: "",
  };
  const next = mutate(
    s,
    "saveEntity",
    { entity: "attendance", value },
    "test",
  ).state;
  const a = next.attendance.find((a) => a.id === value.id)!;
  assert.equal(a.shiftId, "");
  assert.equal(calculate(a).hours, 8);
  assert.equal(a.original.clockIn, "08:00");
  assert.throws(
    () =>
      mutate(
        s,
        "saveEntity",
        {
          entity: "attendance",
          value: { ...value, shiftStart: "17:00", shiftEnd: "17:00" },
        },
        "test",
      ),
    /Choose a shift/,
  );
});
