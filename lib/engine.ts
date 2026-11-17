import type { Attendance, Policy, Workspace, PayrollRow } from "./model";
export const roundMoney = (v: number) =>
  Math.round((v + Number.EPSILON) * 100) / 100;
export const toMinutes = (v: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return NaN;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};
export const clock = (v: number) =>
  Number.isFinite(v)
    ? String(Math.floor(v / 60) % 24).padStart(2, "0") +
      ":" +
      String(Math.floor(v % 60)).padStart(2, "0")
    : "—";
export function calculate(
  a: Pick<
    Attendance,
    | "clockIn"
    | "clockOut"
    | "shiftStart"
    | "shiftEnd"
    | "breakMinutes"
    | "rate"
    | "policy"
  >,
) {
  const p = a.policy;
  let start = toMinutes(a.clockIn),
    end = toMinutes(a.clockOut),
    ss = toMinutes(a.shiftStart),
    se = toMinutes(a.shiftEnd);
  const errors: string[] = [];
  if (!Number.isFinite(start) || !Number.isFinite(end))
    errors.push("Missing clock-in or clock-out");
  if (!Number.isFinite(ss) || !Number.isFinite(se) || ss === se)
    errors.push("Invalid shift");
  if (errors.length)
    return {
      adjustedIn: NaN,
      adjustedOut: NaN,
      rawHours: 0,
      hours: 0,
      regularHours: 0,
      otHours: 0,
      regularPay: 0,
      otPay: 0,
      total: 0,
      errors,
    };
  if (se < ss) {
    se += 1440;
    if (start < ss - 720) start += 1440;
    if (end < ss - 720) end += 1440;
  }
  if (end < start) end += 1440;
  if (end === start) errors.push("Clock-in and clock-out are identical");
  let ai =
    start >= ss && start <= ss + p.grace
      ? ss
      : Math.ceil(start / p.interval) * p.interval;
  let ao =
    end <= se && end >= se - p.grace
      ? se
      : Math.floor(end / p.interval) * p.interval;
  if (!p.outsideShift) {
    ai = Math.max(ss, ai);
    ao = Math.min(se, ao);
  }
  const rawHours = (end - start) / 60;
  const hours = Math.max(0, ao - ai - a.breakMinutes) / 60;
  const regularHours = Math.min(hours, p.dailyRegularHours),
    otHours = Math.max(0, hours - p.dailyRegularHours);
  const regularPay = roundMoney(regularHours * a.rate),
    otPay = roundMoney(otHours * a.rate * p.otMultiplier);
  if (hours <= 0) errors.push("No payable hours");
  if (a.breakMinutes > ao - ai) errors.push("Break exceeds working duration");
  if (rawHours > p.maxHours || hours > p.maxHours)
    errors.push("Unusual working hours");
  return {
    adjustedIn: ai,
    adjustedOut: ao,
    rawHours,
    hours,
    regularHours,
    otHours,
    regularPay,
    otPay,
    total: roundMoney(regularPay + otPay),
    errors,
  };
}
export function blockingIssues(a: Attendance) {
  return calculate(a).errors.filter(
    (e) => e !== "Unusual working hours" || !a.reviewNote.trim(),
  );
}
export function isLocked(
  s: Workspace,
  a: Pick<Attendance, "companyId" | "date">,
) {
  return s.runs.some(
    (r) =>
      r.companyId === a.companyId &&
      r.status !== "Draft" &&
      r.status !== "Cancelled" &&
      r.start <= a.date &&
      r.end >= a.date,
  );
}
export function selectedAttendance(
  s: Workspace,
  companyId: string,
  start: string,
  end: string,
) {
  return s.attendance
    .filter(
      (a) => a.companyId === companyId && a.date >= start && a.date <= end,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function fingerprint(rows: Attendance[]) {
  return JSON.stringify(
    rows.map((a) => [
      a.id,
      a.updatedAt,
      a.workerId,
      a.date,
      a.clockIn,
      a.clockOut,
      a.rate,
      a.breakMinutes,
      a.shiftStart,
      a.shiftEnd,
      a.policy,
      a.reviewNote,
    ]),
  );
}
export function buildRows(
  s: Workspace,
  companyId: string,
  start: string,
  end: string,
): PayrollRow[] {
  const records = selectedAttendance(s, companyId, start, end);
  return s.workers
    .filter((w) => w.companyId === companyId)
    .map((w) => {
      const ats = records.filter((a) => a.workerId === w.id);
      const calc = ats.map(calculate);
      const regularPay = roundMoney(calc.reduce((n, c) => n + c.regularPay, 0)),
        otPay = roundMoney(calc.reduce((n, c) => n + c.otPay, 0));
      return {
        workerId: w.id,
        name: w.name,
        code: w.code,
        bank: w.bank,
        account: w.account,
        paymentMethod: w.paymentMethod,
        days: ats.length,
        regularHours: calc.reduce((n, c) => n + c.regularHours, 0),
        otHours: calc.reduce((n, c) => n + c.otHours, 0),
        regularPay,
        otPay,
        allowance: 0,
        deduction: 0,
        adjustmentNote: "",
        gross: roundMoney(regularPay + otPay),
        net: roundMoney(regularPay + otPay),
        attendanceIds: ats.map((a) => a.id),
      };
    })
    .filter((r) => r.days > 0);
}
export function anomalies(s: Workspace, companyId: string, month: string) {
  const ats = s.attendance.filter(
    (a) =>
      (!companyId || a.companyId === companyId) && a.date.startsWith(month),
  );
  const keys = new Set<string>();
  return ats.flatMap((a) => {
    const k = a.workerId + ":" + a.date;
    const dupe = keys.has(k);
    keys.add(k);
    return [
      ...calculate(a).errors,
      ...(dupe ? ["Duplicate attendance"] : []),
    ].map((message) => ({
      id: a.id + message,
      attendance: a,
      message,
      resolved: message === "Unusual working hours" && !!a.reviewNote,
    }));
  });
}
