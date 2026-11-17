export type Company = {
  id: string;
  name: string;
  registration: string;
  contact: string;
  email: string;
  address: string;
  status: "Active" | "Archived";
  policy: Policy;
};
export type Policy = {
  grace: number;
  interval: number;
  dailyRegularHours: number;
  otMultiplier: number;
  maxHours: number;
  outsideShift: boolean;
};
export type Site = {
  id: string;
  companyId: string;
  name: string;
  type: "Warehouse" | "Property" | "Office" | "Other";
  address: string;
  status: "Active" | "Archived";
};
export type Shift = {
  id: string;
  companyId: string;
  siteId: string;
  name: string;
  start: string;
  end: string;
  breakMinutes: number;
  status: "Active" | "Archived";
};
export type Worker = {
  id: string;
  code: string;
  name: string;
  companyId: string;
  siteId: string;
  shiftId: string;
  rate: number;
  phone: string;
  bank: string;
  account: string;
  paymentMethod: "Bank transfer" | "Cash";
  deletedAt?: string;
  status: "Active" | "Inactive";
};
export type Attendance = {
  id: string;
  companyId: string;
  siteId: string;
  workerId: string;
  shiftId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  rate: number;
  shiftStart: string;
  shiftEnd: string;
  policy: Policy;
  sourceId: string;
  notes: string;
  reviewNote: string;
  original: { clockIn: string; clockOut: string; breakMinutes: number };
  createdAt: string;
  updatedAt: string;
};
export type PayrollRow = {
  workerId: string;
  name: string;
  code: string;
  bank: string;
  account: string;
  paymentMethod: string;
  days: number;
  regularHours: number;
  otHours: number;
  regularPay: number;
  otPay: number;
  allowance: number;
  deduction: number;
  adjustmentNote: string;
  gross: number;
  net: number;
  attendanceIds: string[];
};
export type Run = {
  id: string;
  companyId: string;
  companyName: string;
  companyAddress: string;
  start: string;
  end: string;
  status: "Draft" | "Finalized" | "Paid" | "Cancelled";
  rows: PayrollRow[];
  fingerprint: string;
  createdAt: string;
  createdBy: string;
  finalizedAt: string;
  finalizedBy: string;
  paidAt: string;
  paymentReference: string;
};
export type Upload = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  rows: number;
};
export type Workspace = {
  version: 2;
  companies: Company[];
  sites: Site[];
  shifts: Shift[];
  workers: Worker[];
  attendance: Attendance[];
  runs: Run[];
  demo: boolean;
};
export const defaultPolicy: Policy = {
  grace: 5,
  interval: 30,
  dailyRegularHours: 8,
  otMultiplier: 1.5,
  maxHours: 16,
  outsideShift: false,
};
export const emptyWorkspace: Workspace = {
  version: 2,
  companies: [],
  sites: [],
  shifts: [],
  workers: [],
  attendance: [],
  runs: [],
  demo: false,
};
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
export const money = (n: number) =>
  "RM " +
  Number(n || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const displayDate = (d: string) =>
  d
    ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
