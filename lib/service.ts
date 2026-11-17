import { z } from "zod";
import {
  emptyWorkspace,
  defaultPolicy,
  type Workspace,
  type Attendance,
  type Run,
} from "./model";
import {
  buildRows,
  blockingIssues,
  fingerprint,
  isLocked,
  selectedAttendance,
  roundMoney,
} from "./engine";
const text = z.string().trim().max(500),
  id = z.string().min(1).max(100),
  num = z.coerce.number().finite(),
  amount = num.min(0).max(1000000),
  time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (d) => new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d,
      "Invalid calendar date",
    );
const policy = z.object({
  grace: num.int().min(0).max(60),
  interval: num.int().min(1).max(120),
  dailyRegularHours: num.min(0.5).max(24),
  otMultiplier: num.min(1).max(10),
  maxHours: num.min(1).max(24),
  outsideShift: z.boolean(),
});
const schemas = {
  companies: z.object({
    id,
    name: text.min(1),
    registration: text,
    contact: text,
    email: z.union([z.literal(""), z.string().email()]),
    address: text,
    status: z.enum(["Active", "Archived"]),
    policy,
  }),
  sites: z.object({
    id,
    companyId: id,
    name: text.min(1),
    type: z.enum(["Warehouse", "Property", "Office", "Other"]),
    address: text,
    status: z.enum(["Active", "Archived"]),
  }),
  shifts: z
    .object({
      id,
      companyId: id,
      siteId: text,
      name: text.min(1),
      start: time,
      end: time,
      breakMinutes: num.int().min(0).max(720),
      status: z.enum(["Active", "Archived"]),
    })
    .refine((s) => s.start !== s.end, "Shift start and end must differ"),
  workers: z.object({
    id,
    companyId: id,
    siteId: text,
    shiftId: text,
    code: text.min(1),
    name: text.min(1),
    rate: amount.positive(),
    phone: text,
    bank: text,
    account: text,
    paymentMethod: z.enum(["Bank transfer", "Cash"]),
    status: z.enum(["Active", "Inactive"]),
  }),
  attendance: z.object({
    id,
    companyId: id,
    siteId: text,
    workerId: id,
    shiftId: id,
    date,
    clockIn: z.union([z.literal(""), time]),
    clockOut: z.union([z.literal(""), time]),
    breakMinutes: num.int().min(0).max(720),
    notes: text,
    reviewNote: text,
    sourceId: text,
    rate: amount.positive().optional(),
  }),
};
function need(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
function company(s: Workspace, c: string) {
  const found = s.companies.find((x) => x.id === c);
  need(found, "Select a valid company");
  return found;
}
function validateLinks(s: Workspace, entity: string, v: any) {
  const c = company(s, v.companyId);
  if (v.siteId) {
    const site = s.sites.find((x) => x.id === v.siteId && x.companyId === c.id);
    need(site, "Property must belong to the selected company");
  }
  if (v.shiftId) {
    const shift = s.shifts.find(
      (x) => x.id === v.shiftId && x.companyId === c.id,
    );
    need(shift, "Shift must belong to the selected company");
    if (v.siteId && shift.siteId)
      need(v.siteId === shift.siteId, "Shift belongs to a different property");
  }
  if (entity === "workers")
    need(
      !s.workers.some(
        (w) =>
          w.id !== v.id &&
          w.companyId === v.companyId &&
          w.code.toLowerCase() === v.code.toLowerCase(),
      ),
      "Worker ID already exists in this company",
    );
}
function attendance(s: Workspace, input: any, now: string): Attendance {
  const v = schemas.attendance.parse(input);
  validateLinks(s, "attendance", v);
  const w = s.workers.find(
    (x) => x.id === v.workerId && x.companyId === v.companyId,
  );
  need(w, "Worker must belong to the selected company");
  const shift = s.shifts.find((x) => x.id === v.shiftId);
  need(shift, "Choose a shift");
  need(
    !isLocked(s, v),
    "Attendance belongs to finalized payroll and cannot be changed",
  );
  const old = s.attendance.find((x) => x.id === v.id);
  if (old)
    need(
      !isLocked(s, old),
      "Finalized attendance cannot be moved to another date",
    );
  need(
    !s.attendance.some(
      (a) => a.id !== v.id && a.workerId === v.workerId && a.date === v.date,
    ),
    "Duplicate: worker already has attendance on this work date",
  );
  const preserve =
    old && old.companyId === v.companyId && old.shiftId === v.shiftId;
  return {
    ...v,
    rate: v.rate ?? old?.rate ?? w.rate,
    shiftStart: preserve ? old.shiftStart : shift.start,
    shiftEnd: preserve ? old.shiftEnd : shift.end,
    policy: preserve ? old.policy : { ...company(s, v.companyId).policy },
    original: old?.original || {
      clockIn: v.clockIn,
      clockOut: v.clockOut,
      breakMinutes: v.breakMinutes,
    },
    createdAt: old?.createdAt || now,
    updatedAt: now,
  };
}
export function mutate(
  previous: Workspace,
  action: string,
  payload: any,
  actor: string,
) {
  const s = structuredClone(previous);
  const now = new Date().toISOString();
  let detail = "";
  let result: any = null;
  if (action === "saveEntity") {
    const { entity } = payload;
    need(
      ["companies", "sites", "shifts", "workers", "attendance"].includes(
        entity,
      ),
      "Unknown module",
    );
    const key = entity as keyof typeof schemas;
    const val: any =
      entity === "attendance"
        ? attendance(s, payload.value, now)
        : schemas[key].parse(payload.value);
    if (entity !== "companies" && entity !== "attendance")
      validateLinks(s, entity, val);
    if (entity === "shifts") {
      const duration =
        (Number(val.end.slice(0, 2)) * 60 +
          Number(val.end.slice(3)) -
          (Number(val.start.slice(0, 2)) * 60 + Number(val.start.slice(3))) +
          1440) %
        1440;
      need(val.breakMinutes < duration, "Break must be shorter than the shift");
    }
    if (entity === "workers" && s.attendance.some((a) => a.workerId === val.id))
      need(
        s.workers.find((w) => w.id === val.id)?.companyId === val.companyId,
        "A worker with attendance cannot be moved between companies",
      );
    const list = (s as any)[entity];
    const index = list.findIndex((x: any) => x.id === val.id);
    if (index < 0) list.push(val);
    else list[index] = val;
    detail = `${index < 0 ? "Created" : "Updated"} ${entity}: ${val.name || val.date}`;
  } else if (action === "removeAttendance") {
    const a = s.attendance.find((x) => x.id === payload.id);
    need(a, "Attendance not found");
    need(!isLocked(s, a), "Finalized attendance is locked");
    s.attendance = s.attendance.filter((x) => x.id !== a.id);
    detail = `Removed attendance ${a.id} (${a.date}); original ${JSON.stringify(a.original)}`;
  } else if (action === "importAttendance") {
    need(
      Array.isArray(payload.rows) &&
        payload.rows.length > 0 &&
        payload.rows.length <= 500,
      "Import 1–500 rows at a time",
    );
    const imported: Attendance[] = [];
    for (const row of payload.rows) {
      const a = attendance(
        s,
        { ...row, id: crypto.randomUUID(), sourceId: payload.sourceId || "" },
        now,
      );
      s.attendance.push(a);
      imported.push(a);
    }
    detail = `Imported ${imported.length} attendance records`;
    result = { imported: imported.length, sourceId: payload.sourceId };
  } else if (action === "createRun") {
    const c = company(s, payload.companyId);
    const start = date.parse(payload.start),
      end = date.parse(payload.end);
    need(start <= end, "End date must follow start date");
    need(
      !s.runs.some(
        (r) =>
          r.status !== "Cancelled" &&
          r.companyId === c.id &&
          r.start <= end &&
          r.end >= start,
      ),
      "A payroll run already covers part of these dates",
    );
    const ats = selectedAttendance(s, c.id, start, end);
    need(ats.length > 0, "No attendance in this period");
    const rows = buildRows(s, c.id, start, end);
    const run: Run = {
      id: crypto.randomUUID(),
      companyId: c.id,
      companyName: c.name,
      companyAddress: c.address,
      start,
      end,
      status: "Draft",
      rows,
      fingerprint: fingerprint(ats),
      createdAt: now,
      createdBy: actor,
      finalizedAt: "",
      finalizedBy: "",
      paidAt: "",
      paymentReference: "",
    };
    s.runs.unshift(run);
    detail = `Created payroll draft ${c.name}, ${start}–${end}`;
    result = { id: run.id };
  } else if (
    [
      "updateRunRow",
      "refreshRun",
      "finalizeRun",
      "payRun",
      "cancelRun",
    ].includes(action)
  ) {
    const r = s.runs.find((x) => x.id === payload.id);
    need(r, "Payroll run not found");
    if (action === "payRun") {
      need(
        r.status === "Finalized",
        "Only finalized payroll can be marked paid",
      );
      need(
        text.min(1).parse(payload.paymentReference),
        "Enter a payment reference",
      );
      r.status = "Paid";
      r.paidAt = now;
      r.paymentReference = payload.paymentReference;
      detail = `Recorded payment for ${r.id}: ${r.paymentReference}`;
    } else {
      need(r.status === "Draft", "Only draft payroll may be edited");
      if (action === "cancelRun") {
        r.status = "Cancelled";
        detail = `Cancelled draft ${r.id}`;
      }
      if (action === "refreshRun") {
        r.rows = buildRows(s, r.companyId, r.start, r.end);
        need(r.rows.length, "No attendance in this period");
        r.fingerprint = fingerprint(
          selectedAttendance(s, r.companyId, r.start, r.end),
        );
        detail = `Refreshed draft ${r.id}; adjustments reset`;
      }
      if (action === "updateRunRow") {
        const row = r.rows.find((x) => x.workerId === payload.workerId);
        need(row, "Payroll row not found");
        row.allowance = amount.parse(payload.allowance);
        row.deduction = amount.parse(payload.deduction);
        row.adjustmentNote = text.parse(payload.adjustmentNote);
        need(
          (!row.allowance && !row.deduction) || row.adjustmentNote.length > 0,
          "Explain allowances or deductions in the adjustment note",
        );
        row.gross = roundMoney(row.regularPay + row.otPay + row.allowance);
        need(
          row.deduction <= row.gross,
          "Deductions cannot exceed gross earnings",
        );
        row.net = roundMoney(row.gross - row.deduction);
        detail = `Adjusted draft ${r.id}, ${row.code}: allowance ${row.allowance}, deduction ${row.deduction}, note ${row.adjustmentNote}`;
      }
      if (action === "finalizeRun") {
        const ats = selectedAttendance(s, r.companyId, r.start, r.end);
        need(
          fingerprint(ats) === r.fingerprint,
          "Attendance changed. Refresh this draft and review adjustments before finalizing.",
        );
        const errors = ats.flatMap((a) => blockingIssues(a));
        need(
          errors.length === 0,
          `Resolve ${errors.length} attendance issue(s) before finalizing`,
        );
        need(
          !s.runs.some(
            (x) =>
              x.id !== r.id &&
              x.companyId === r.companyId &&
              x.status !== "Draft" &&
              x.status !== "Cancelled" &&
              x.start <= r.end &&
              x.end >= r.start,
          ),
          "Another finalized run overlaps this period",
        );
        r.status = "Finalized";
        r.finalizedAt = now;
        r.finalizedBy = actor;
        detail = `Finalized payroll ${r.id}, net RM ${roundMoney(r.rows.reduce((n, w) => n + w.net, 0))}`;
      }
    }
  } else if (action === "loadDemo") {
    need(
      !s.companies.length && !s.workers.length && !s.attendance.length,
      "Sample data can only be loaded into an empty workspace",
    );
    Object.assign(s, makeDemo());
    detail = "Loaded demonstration workspace";
  } else if (action === "clearDemo") {
    need(s.demo, "Only a sample workspace can be reset");
    Object.assign(s, structuredClone(emptyWorkspace));
    detail = "Cleared demonstration records";
  } else throw Error("Unknown action");
  need(
    JSON.stringify(s).length < 4000000,
    "Workspace limit reached. Export records before adding more data.",
  );
  return { state: s, detail, result };
}
export function makeDemo(): Workspace {
  const s: Workspace = structuredClone(emptyWorkspace);
  s.demo = true;
  const c1 = crypto.randomUUID(),
    c2 = crypto.randomUUID(),
    p1 = crypto.randomUUID(),
    p2 = crypto.randomUUID(),
    sh1 = crypto.randomUUID(),
    sh2 = crypto.randomUUID();
  s.companies = [
    {
      id: c1,
      name: "Meridian Logistics",
      registration: "DEMO-001",
      contact: "Operations team",
      email: "",
      address: "Shah Alam, Selangor",
      status: "Active",
      policy: { ...defaultPolicy },
    },
    {
      id: c2,
      name: "Northstar Properties",
      registration: "DEMO-002",
      contact: "Property team",
      email: "",
      address: "Johor Bahru, Johor",
      status: "Active",
      policy: { ...defaultPolicy, dailyRegularHours: 9 },
    },
  ];
  s.sites = [
    {
      id: p1,
      companyId: c1,
      name: "Shah Alam Distribution Centre",
      type: "Warehouse",
      address: "Shah Alam",
      status: "Active",
    },
    {
      id: p2,
      companyId: c2,
      name: "Southbank Residences",
      type: "Property",
      address: "Johor Bahru",
      status: "Active",
    },
  ];
  s.shifts = [
    {
      id: sh1,
      companyId: c1,
      siteId: p1,
      name: "Day shift",
      start: "07:30",
      end: "19:30",
      breakMinutes: 60,
      status: "Active",
    },
    {
      id: sh2,
      companyId: c2,
      siteId: p2,
      name: "Night shift",
      start: "19:30",
      end: "07:30",
      breakMinutes: 60,
      status: "Active",
    },
  ];
  const names = [
    "Nur Aisyah",
    "Muhammad Amir",
    "Tan Wei Ming",
    "Siti Hajar",
    "Arjun Kumar",
    "Nur Farhana",
    "Lim Jia Xin",
    "Adam Hakim",
  ];
  const month = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" })
    .slice(0, 7);
  for (let i = 0; i < names.length; i++) {
    const workerId = crypto.randomUUID(),
      c = i < 6 ? c1 : c2,
      shift = i < 6 ? s.shifts[0] : s.shifts[1];
    s.workers.push({
      id: workerId,
      companyId: c,
      siteId: shift.siteId,
      shiftId: shift.id,
      code: "TW-" + String(i + 1).padStart(3, "0"),
      name: names[i],
      rate: 10 + (i % 3),
      phone: "",
      bank: "Sample bank",
      account: "DEMO" + (1000 + i),
      paymentMethod: "Bank transfer",
      status: "Active",
    });
    for (let j = 10; j <= 14; j++) {
      const cin = i < 6 ? (i % 2 ? "07:33" : "07:30") : "19:30",
        cout =
          i === 2 && j === 14
            ? ""
            : i < 6
              ? j % 2
                ? "19:27"
                : "19:30"
              : "07:30";
      const a = attendance(
        s,
        {
          id: crypto.randomUUID(),
          companyId: c,
          siteId: shift.siteId,
          workerId,
          shiftId: shift.id,
          date: month + "-" + j,
          clockIn: cin,
          clockOut: cout,
          breakMinutes: 60,
          notes: "Sample record",
          reviewNote: "",
          sourceId: "",
        },
        new Date().toISOString(),
      );
      s.attendance.push(a);
    }
  }
  return s;
}
