"use client";
import { useState, useEffect, createContext, useContext } from "react";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Users,
  Clock3,
  ScanLine,
  SlidersHorizontal,
  Calculator,
  Wallet,
  ClipboardCheck,
  FileBarChart2,
  History,
  ShieldCheck,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Search,
  AlertTriangle,
  RefreshCw,
  X,
  Menu,
  Leaf,
  LogOut,
  CalendarDays,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  UploadCloud,
  FolderOpen,
  ExternalLink,
  LockKeyhole,
} from "lucide-react";
import {
  emptyWorkspace,
  defaultPolicy,
  today,
  money,
  displayDate,
  type Workspace,
  type Run,
} from "../lib/model";
import {
  calculate,
  clock,
  anomalies,
  isLocked,
  blockingIssues,
  buildRows,
  fingerprint,
  selectedAttendance,
} from "../lib/engine";
import { exportWorkbook, exportPayslip, importTemplate } from "../lib/exports";
import {
  extractFile,
  textRows,
  validateImport,
  type ImportRow,
} from "../lib/importer";
import {
  Button,
  Card,
  Empty,
  Badge,
  Field,
  Modal,
  Stat,
  Table,
  Person,
} from "../components/payroll/ui";
const Ctx = createContext<any>(null);
const useApp = () => useContext(Ctx);
const groups = [
  {
    title: "WORKSPACE",
    items: [
      ["Overview", LayoutDashboard],
      ["Companies & properties", Building2],
      ["Temporary workers", Users],
      ["Shift management", Clock3],
    ],
  },
  {
    title: "ATTENDANCE & PAYROLL",
    items: [
      ["Attendance scanner", ScanLine],
      ["Attendance records", CalendarDays],
      ["Working hours", Calculator],
      ["Payroll calculator", Wallet],
      ["Payroll verification", ClipboardCheck],
    ],
  },
  {
    title: "INSIGHTS & SETTINGS",
    items: [
      ["Reports & export", FileBarChart2],
      ["Payroll history", History],
      ["Error detection", AlertTriangle],
      ["Attendance policies", SlidersHorizontal],
      ["Audit trail", ShieldCheck],
    ],
  },
];
const desc: any = {
  "All workspaces":
    "Superadmin access to database records, uploaded documents, and audit history.",
  Overview:
    "Attendance, working hours, and payroll for your temporary workforce.",
  "Companies & properties":
    "Manage clients, warehouses, properties, and their payroll policies.",
  "Temporary workers":
    "Worker profiles, hourly rates, assignments, and payment details.",
  "Shift management":
    "Different teams. Different shifts. One organised workspace.",
  "Attendance scanner":
    "Turn spreadsheets, PDFs, and punch-card images into reviewed attendance.",
  "Attendance records": "Original clock times and payable hours, side by side.",
  "Working hours":
    "Test attendance rules and see exactly how payable hours are calculated.",
  "Payroll calculator":
    "Prepare wages, overtime, allowances, and deductions for each company.",
  "Payroll verification":
    "Review every figure before finalizing a payroll run.",
  "Reports & export":
    "Download real Excel workbooks and individual PDF payslips.",
  "Payroll history":
    "A complete record of finalized payroll and recorded payments.",
  "Error detection":
    "Find missing punches, duplicates, and unusual working hours.",
  "Attendance policies":
    "Configure tolerance, rounding, and overtime rules for each company.",
  "Audit trail":
    "A transparent record of changes, approvals, and payroll adjustments.",
};
export default function App() {
  const [state, setState] = useState<Workspace>(emptyWorkspace),
    [revision, setRevision] = useState(0),
    [files, setFiles] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [page, setPage] = useState("Overview"),
    [companyId, setCompanyId] = useState(""),
    [month, setMonth] = useState(today().slice(0, 7)),
    [modal, setModal] = useState<any>(null),
    [mobile, setMobile] = useState(false),
    [selectedRun, setSelectedRun] = useState(""),
    [activeWorkspace, setActiveWorkspace] = useState(""),
    [workspaceItems, setWorkspaceItems] = useState<any[]>([]),
    [workspace, setWorkspace] = useState<any>({
      signedIn: false,
      name: "Guest workspace",
    });
  const apiUrl = (path: string, target = activeWorkspace) =>
    target
      ? path +
        (path.includes("?") ? "&" : "?") +
        "workspace=" +
        encodeURIComponent(target)
      : path;
  async function load(target = activeWorkspace) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/state", target), {
          cache: "no-store",
        }),
        r: any = await res.json();
      if (!res.ok) throw Error(r.error);
      setState(r.data);
      if (r.workspace) setWorkspace(r.workspace);
      setRevision(r.revision);
      setFiles(r.files);
      setAudit(r.audit);
      if (r.workspace?.isSuperadmin) {
        const res = await fetch("/api/admin/workspaces", { cache: "no-store" });
        if (res.ok) {
          const list: any = await res.json();
          setWorkspaceItems(list.items);
        }
      }
    } catch (e: any) {
      setError(e.message || "Unable to load workspace");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  async function act(
    action: string,
    payload: any,
    success = "Saved successfully",
  ) {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/state"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload, revision }),
      });
      const r: any = await res.json();
      if (!res.ok) throw Error(r.error);
      setState(r.data);
      setRevision(r.revision);
      if (r.auditEvent) setAudit((a) => [r.auditEvent, ...a].slice(0, 200));
      setToast(success);
      return r;
    } catch (e: any) {
      setError(e.message || "Unable to save");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const navigate = (p: string) => {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const open = (kind: string, value: any = {}) => {
    setError("");
    setModal({ kind, value });
  };
  const scoped = (list: any[]) =>
    list.filter((x) => !companyId || x.companyId === companyId);
  const ctx = {
    state,
    apiUrl,
    workspace,
    workspaceItems,
    activeWorkspace,
    switchWorkspace: (key: string) => {
      if (busy) return;
      setActiveWorkspace(key);
      setCompanyId("");
      setSelectedRun("");
      setModal(null);
      load(key);
    },
    act,
    files,
    setFiles,
    audit,
    busy,
    error,
    setError,
    setToast,
    companyId,
    setCompanyId,
    month,
    setMonth,
    page,
    navigate,
    open,
    modal,
    setModal,
    scoped,
    selectedRun,
    setSelectedRun,
  };
  const monthLabel = new Date(month + "-02T12:00:00").toLocaleDateString(
    "en-MY",
    { month: "long", year: "numeric" },
  );
  const issues = anomalies(state, companyId, month).filter(
    (x) => !x.resolved,
  ).length;
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <aside className={mobile ? "mobileOpen" : ""}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("Overview");
            }}
          >
            <span className="brandMark">
              <Leaf size={23} />
            </span>
            <span>
              smartpayroll<span className="brandPeriod">.</span>
            </span>
          </a>
          <div className="workspaceCard">
            <span>SP</span>
            <div>
              <b>Payroll workspace</b>
              <small>Temporary workforce</small>
            </div>
            <ChevronRight size={15} />
          </div>
          <div className="navScroll">
            {groups.map((g) => (
              <div className="navGroup" key={g.title}>
                <p>{g.title}</p>
                {g.items.map(([label, Icon]: any) => (
                  <button
                    key={label}
                    onClick={() => navigate(label)}
                    className={page === label ? "active" : ""}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {label === "Error detection" && issues > 0 && (
                      <i>{issues}</i>
                    )}
                    {label === "Temporary workers" && (
                      <i className="neutral">{state.workers.length}</i>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="sidebarFooter">
            <div className="secure">
              <ShieldCheck size={16} />
              <div>
                <b>Your separate workspace</b>
                <small>Records stay within this workspace</small>
              </div>
            </div>
            <div className="profile">
              <span>SP</span>
              <div>
                <b>{workspace.name}</b>
                <small>
                  {workspace.signedIn ? "Signed in" : "Saved for this browser"}
                </small>
              </div>
              {workspace.signedIn ? (
                <form method="post" action="/signout">
                  <button type="submit" aria-label="Sign out" title="Sign out">
                    <LogOut size={15} />
                  </button>
                </form>
              ) : (
                <a href="/login" title="Sign in" aria-label="Sign in">
                  <LogOut size={15} />
                </a>
              )}
            </div>
          </div>
        </aside>
        {mobile && (
          <button
            className="mobileScrim"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <main>
          <header>
            <div className="headerLeft">
              <button
                className="iconBtn mobileToggle"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={21} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <b>{page}</b>
            </div>
            <div className="headerRight">
              <span className="sync">
                <i />
                {busy ? "Saving changes" : "All changes saved"}
              </span>
              <button
                className="iconBtn"
                aria-label="Reload workspace"
                onClick={() => load()}
                disabled={busy}
              >
                <RefreshCw size={16} />
              </button>
              <span className="headerAvatar">SP</span>
            </div>
          </header>
          <div className="content">
            <div className="pageHeading">
              <div>
                <div className="eyebrow">
                  SMARTPAYROLL /{" "}
                  {page === "Overview"
                    ? "YOUR WORKFORCE, AT A GLANCE"
                    : "TEMPORARY WORKFORCE MANAGEMENT"}
                </div>
                <h1>{page === "Overview" ? "Payroll dashboard" : page}</h1>
                <p>{desc[page]}</p>
              </div>
              <div className="filters">
                <label className="companyFilter">
                  <Building2 size={16} />
                  <select
                    aria-label="Filter by company"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="">All companies</option>
                    {state.companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="monthFilter">
                  <CalendarDays size={16} />
                  <input
                    aria-label="Reporting month"
                    required
                    type="month"
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) setMonth(e.target.value);
                    }}
                  />
                </label>
              </div>
            </div>
            {workspace.isSuperadmin && (
              <div className="superadminBar">
                <ShieldCheck size={20} />
                <div>
                  <b>Superadmin · Access all workspaces</b>
                  <small>
                    Choose a workspace to view and manage its records.
                  </small>
                </div>
                <select
                  aria-label="Superadmin workspace"
                  value={activeWorkspace}
                  disabled={busy || loading}
                  onChange={(e) => ctx.switchWorkspace(e.target.value)}
                >
                  <option value="">Your original workspace</option>
                  {workspaceItems
                    .filter(
                      (w: any) =>
                        w.version === 2 && w.key !== "smartpayroll-v2",
                    )
                    .map((w: any) => (
                      <option key={w.key} value={w.key}>
                        {w.label} · {w.workers} workers
                      </option>
                    ))}
                </select>
                <button
                  className="btn secondary"
                  onClick={() => navigate("All workspaces")}
                >
                  All data
                </button>
              </div>
            )}
            {!workspace.signedIn && (
              <div className="guestNote">
                Guest workspace · The workspace owner can administer stored
                records. Keep cookies to return to them. Signing in opens a
                separate account workspace.
              </div>
            )}
            {error && (
              <div role="alert" className="errorBanner">
                <AlertTriangle size={18} />
                <span>{error}</span>
                <Button variant="text" onClick={() => setError("")}>
                  <X size={16} />
                </Button>
              </div>
            )}
            {state.demo && (
              <div className="demoBanner">
                <span>
                  <b>Sample workspace</b> · All names, companies, and payment
                  details are fictional.
                </span>
                <button onClick={() => open("clearDemo")}>
                  Clear sample data <X size={13} />
                </button>
              </div>
            )}
            {loading ? (
              <Card>
                <Empty
                  title="Loading your workspace…"
                  description="Getting your latest records."
                  icon={RefreshCw}
                />
              </Card>
            ) : (
              <>
                {page === "Overview" && <Overview />}
                {page === "All workspaces" && workspace.isSuperadmin && (
                  <AllWorkspaces />
                )}
                {page === "Companies & properties" && <Companies />}
                {page === "Temporary workers" && <Workers />}
                {page === "Shift management" && <Shifts />}
                {page === "Attendance scanner" && <Scanner />}
                {page === "Attendance records" && <Attendance />}
                {page === "Working hours" && <Hours />}
                {page === "Payroll calculator" && <Payroll />}
                {page === "Payroll verification" && <Verification />}
                {page === "Reports & export" && <Reports />}
                {page === "Payroll history" && <Payroll history />}
                {page === "Error detection" && <Errors />}
                {page === "Attendance policies" && <Policies />}
                {page === "Audit trail" && <Audit />}
              </>
            )}
            <footer>
              <span>
                <b>
                  smartpayroll<span className="brandPeriod">.</span>
                </b>{" "}
                <small>Every hour accounted for.</small>
              </span>
              <small>MYR · Kuala Lumpur time · {monthLabel}</small>
            </footer>
          </div>
        </main>
        {modal && (
          <Editor
            key={
              modal.kind +
              ":" +
              (modal.value?.id || modal.value?.workerId || "new")
            }
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <CheckCircle2 size={18} />
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
function Overview() {
  const { state, companyId, month, scoped, navigate, open, act, busy } =
    useApp();
  const ats = state.attendance.filter(
    (a: any) =>
      (!companyId || a.companyId === companyId) && a.date.startsWith(month),
  );
  const calc = ats.map(calculate);
  const hours = calc.reduce((n: number, c: any) => n + c.hours, 0),
    pay = calc.reduce((n: number, c: any) => n + c.total, 0),
    ot = calc.reduce((n: number, c: any) => n + c.otHours, 0);
  const workers = scoped(state.workers).filter(
    (w: any) => w.status === "Active",
  );
  const issues = anomalies(state, companyId, month).filter(
    (i: any) => !i.resolved,
  );
  const drafts = scoped(state.runs).filter((r: any) => r.status === "Draft");
  const weekValues = Array.from({ length: 5 }, (_, i) =>
    ats
      .filter((a: any) => Math.floor((Number(a.date.slice(8)) - 1) / 7) === i)
      .reduce((n: number, a: any) => n + calculate(a).hours, 0),
  );
  const max = Math.max(...weekValues, 1);
  return (
    <>
      <section className="payrollSummary" aria-label="Monthly payroll overview">
        <div className="summaryTotal">
          <span className="summaryLabel">ESTIMATED PAYROLL</span>
          <strong>{money(pay)}</strong>
          <p>Recorded attendance · {month}</p>
          <Button onClick={() => navigate("Payroll calculator")}>
            <Plus size={15} /> New payroll run
          </Button>
        </div>
        <div className="payrollBreakdown">
          <div>
            <i className="regularDot" />
            <span>
              Regular pay
              <strong>
                {money(calc.reduce((n: number, c: any) => n + c.regularPay, 0))}
              </strong>
            </span>
          </div>
          <div>
            <i className="overtimeDot" />
            <span>
              Overtime pay
              <strong>
                {money(calc.reduce((n: number, c: any) => n + c.otPay, 0))}
              </strong>
            </span>
          </div>
          <small>Before allowances and deductions</small>
        </div>
        <div className="payrollDonutArea">
          <div
            className="payrollDonut"
            role="img"
            aria-label={
              pay > 0
                ? "Estimated payroll split between regular pay and overtime pay. Amounts are listed beside the chart."
                : "No recorded payroll for this period"
            }
            style={{
              background:
                pay > 0
                  ? `conic-gradient(#56a9cc 0% ${(calc.reduce((n: number, c: any) => n + c.regularPay, 0) / pay) * 100}%, #9b86c7 0% 100%)`
                  : "#e7edf3",
            }}
          >
            <div>
              <b>{ats.length}</b>
              <span>attendance records</span>
            </div>
          </div>
          <small>
            {pay > 0 ? "Payroll composition" : "No payroll recorded yet"}
          </small>
        </div>
      </section>
      <div className="statsGrid">
        <Stat
          label="Active workers"
          value={workers.length}
          description={`${scoped(state.sites).length} properties · ${state.companies.filter((c: any) => !companyId || c.id === companyId).length} companies`}
          icon={Users}
        />
        <Stat
          label="Payable working hours"
          value={hours.toFixed(1)}
          description={`${ot.toFixed(1)} overtime hours included`}
          icon={Clock3}
        />
        <Stat
          label="Estimated wages"
          value={money(pay)}
          description="Regular pay + overtime, before adjustments"
          icon={Wallet}
        />
        <Stat
          label="Needs your attention"
          value={issues.length + drafts.length}
          description={`${issues.length} attendance flags · ${drafts.length} payroll drafts`}
          icon={ClipboardCheck}
          tone="warm"
        />
      </div>
      <div className="dashboardGrid">
        <Card
          title="Working hours at a glance"
          description="A weekly view of this month’s payable hours"
          action={
            <span className="chartLegend">
              <i /> Working hours
            </span>
          }
        >
          <div className="hoursChart">
            {weekValues.map((v, i) => (
              <div key={i}>
                <span>{v.toFixed(1)} h</span>
                <i style={{ height: Math.max(4, (v / max) * 145) + "px" }} />
                <small>Week {i + 1}</small>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Your payday checklist"
          description="A simple path from attendance to payment"
        >
          <div className="checklist">
            {[
              [
                "01",
                "Set up your workforce",
                `${state.companies.length} companies · ${state.workers.length} workers`,
                "Companies & properties",
                state.companies.length > 0,
              ],
              [
                "02",
                "Review attendance",
                `${ats.length} shifts recorded this month`,
                "Attendance records",
                ats.length > 0,
              ],
              [
                "03",
                "Verify & finalize payroll",
                `${drafts.length} drafts ready for review`,
                "Payroll verification",
                state.runs.some(
                  (r: any) => r.status === "Finalized" || r.status === "Paid",
                ),
              ],
            ].map(([n, title, sub, page, done]) => (
              <button key={String(n)} onClick={() => navigate(page)}>
                <span className={done ? "done" : ""}>
                  {done ? <Check size={17} /> : n}
                </span>
                <div>
                  <b>{title}</b>
                  <small>{sub}</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </Card>
      </div>
      {issues.length > 0 && (
        <div className="attentionStrip">
          <AlertTriangle size={21} />
          <div>
            <b>A quick check before payday</b>
            <p>
              {issues.length} attendance issue(s) need a closer look. Keep
              payroll accurate by reviewing them first.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate("Error detection")}
          >
            Review issues <ArrowRight size={15} />
          </Button>
        </div>
      )}
      <Card
        title="Recent attendance"
        description="Actual clock times, transparent calculations."
        action={
          <Button variant="text" onClick={() => navigate("Attendance records")}>
            View register <ArrowUpRight size={15} />
          </Button>
        }
      >
        <AttendanceTable
          rows={[...ats]
            .sort((a: any, b: any) => b.date.localeCompare(a.date))
            .slice(0, 5)}
        />
      </Card>
      {!state.companies.length && (
        <div className="gettingStarted">
          <div>
            <b>Your workspace is ready for its first company.</b>
            <p>
              Start fresh, or explore all modules with fictional sample data.
            </p>
          </div>
          <div className="buttonRow">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act("loadDemo", {}, "Sample workspace loaded")}
            >
              Explore sample data
            </Button>
            <Button onClick={() => open("companies")}>
              <Plus size={16} /> Add a company
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
function Companies() {
  const { state, companyId, open, scoped } = useApp();
  const [tab, setTab] = useState("Companies"),
    [query, setQuery] = useState("");
  const companies = state.companies.filter(
    (c: any) =>
      (!companyId || c.id === companyId) &&
      c.name.toLowerCase().includes(query.toLowerCase()),
  );
  const sites = scoped(state.sites).filter((p: any) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          <button
            className={tab === "Companies" ? "active" : ""}
            onClick={() => setTab("Companies")}
          >
            Companies <span>{state.companies.length}</span>
          </button>
          <button
            className={tab === "Properties" ? "active" : ""}
            onClick={() => setTab("Properties")}
          >
            Warehouses & properties <span>{state.sites.length}</span>
          </button>
        </div>
        <Button
          onClick={() => open(tab === "Companies" ? "companies" : "sites")}
          disabled={tab === "Properties" && !state.companies.length}
        >
          <Plus size={16} /> Add {tab === "Companies" ? "company" : "property"}
        </Button>
      </div>
      <div className="searchBar">
        <Search size={17} />
        <input
          aria-label="Search companies or properties"
          placeholder="Search companies or properties…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {tab === "Companies" ? (
        <div className="companyGrid">
          {companies.map((c: any) => (
            <Card key={c.id}>
              <div className="companyCard">
                <div className="companyCardTop">
                  <span className="companyLogo">
                    {c.name
                      .split(" ")
                      .map((x: string) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <Badge tone={c.status === "Active" ? "green" : "gray"}>
                    {c.status}
                  </Badge>
                </div>
                <h3>{c.name}</h3>
                <p>{c.address || "No address added"}</p>
                <div className="companyMetrics">
                  <div>
                    <b>
                      {
                        state.workers.filter((w: any) => w.companyId === c.id)
                          .length
                      }
                    </b>
                    <small>Workers</small>
                  </div>
                  <div>
                    <b>
                      {
                        state.sites.filter((p: any) => p.companyId === c.id)
                          .length
                      }
                    </b>
                    <small>Properties</small>
                  </div>
                  <div>
                    <b>
                      {
                        state.shifts.filter((p: any) => p.companyId === c.id)
                          .length
                      }
                    </b>
                    <small>Shifts</small>
                  </div>
                </div>
                <div className="companyPolicy">
                  <Clock3 size={14} />
                  {c.policy.grace} min grace · {c.policy.interval} min rounding
                </div>
                <Button
                  variant="secondary full"
                  onClick={() => open("companies", c)}
                >
                  Manage company <ArrowUpRight size={15} />
                </Button>
              </div>
            </Card>
          ))}
          {!companies.length && (
            <Card>
              <Empty
                title="Add your first company"
                description="Each company has its own properties, shifts, and payroll rules."
                action={
                  <Button onClick={() => open("companies")}>
                    <Plus size={16} /> Add company
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <Table
            headers={[
              "Property / warehouse",
              "Company",
              "Type",
              "Address",
              "Status",
              "",
            ]}
            empty={!sites.length}
          >
            {sites.map((p: any) => (
              <tr key={p.id}>
                <td>
                  <b>{p.name}</b>
                </td>
                <td>
                  {state.companies.find((c: any) => c.id === p.companyId)?.name}
                </td>
                <td>
                  <Badge>{p.type}</Badge>
                </td>
                <td>{p.address || "—"}</td>
                <td>
                  <Badge tone={p.status === "Active" ? "green" : "gray"}>
                    {p.status}
                  </Badge>
                </td>
                <td>
                  <Button
                    variant="icon"
                    aria-label={"Edit " + p.name}
                    onClick={() => open("sites", p)}
                  >
                    <Pencil size={15} />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
function AllWorkspaces() {
  const { workspaceItems, switchWorkspace, navigate, activeWorkspace } =
    useApp();
  return (
    <Card
      title="Superadmin · All stored data"
      description="View any current workspace, or export a complete database record with file metadata and audit history."
    >
      <Table
        headers={[
          "Workspace",
          "Companies",
          "Workers",
          "Attendance",
          "Payroll runs",
          "Actions",
        ]}
        empty={!workspaceItems.length}
      >
        {workspaceItems.map((w: any) => (
          <tr key={w.key}>
            <td>
              <b>{w.label}</b>
              <small>
                {w.version === 2 ? "Current workspace" : "Legacy data"}
              </small>
            </td>
            <td>{w.companies}</td>
            <td>{w.workers}</td>
            <td>{w.attendance}</td>
            <td>{w.payroll}</td>
            <td>
              <div className="buttonRow">
                {w.version === 2 && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      switchWorkspace(w.key === "smartpayroll-v2" ? "" : w.key);
                      navigate("Overview");
                    }}
                  >
                    Open workspace
                  </Button>
                )}
                <a
                  className="btn secondary"
                  href={
                    "/api/admin/export?workspace=" + encodeURIComponent(w.key)
                  }
                  download
                >
                  <Download size={14} /> Full export
                </a>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
function Workers() {
  const { state, scoped, open } = useApp();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [workDate, setWorkDate] = useState(today());
  const rows = scoped(state.workers).filter(
    (w: any) =>
      (w.name + " " + w.code).toLowerCase().includes(query.toLowerCase()) &&
      (status === "Deleted"
        ? !!w.deletedAt
        : !w.deletedAt && (!status || w.status === status)),
  );
  return (
    <Card
      title="Your temporary workforce"
      description="Edit assignments and record punch times here. Without an assigned shift, complete punch times define a manual work interval."
      action={
        <Button
          disabled={!state.companies.length}
          onClick={() => open("workers")}
        >
          <Plus size={16} /> Add worker
        </Button>
      }
    >
      <div className="tableToolbar">
        <div className="searchBar">
          <Search size={16} />
          <input
            aria-label="Search workers"
            placeholder="Search name or worker ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="inlineDate">
          Work date
          <input
            aria-label="Worker punch work date"
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          />
        </label>
        <select
          aria-label="Worker status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Current workers</option>
          <option>Active</option>
          <option>Inactive</option>
          <option>Deleted</option>
        </select>
        <span>{rows.length} workers</span>
      </div>
      <Table
        headers={[
          "Worker",
          "Company / rate",
          "Assigned shift",
          "Punch in",
          "Punch out",
          "Break",
          "Record",
          "Actions",
        ]}
        empty={!rows.length}
      >
        {rows.map((w: any) => {
          const a = state.attendance.find(
            (a: any) => a.workerId === w.id && a.date === workDate,
          );
          return (
            <WorkerPunchRow
              key={w.id + workDate + (a?.updatedAt || "")}
              worker={w}
              record={a}
              workDate={workDate}
            />
          );
        })}
      </Table>
    </Card>
  );
}
function WorkerPunchRow({ worker: w, record: a, workDate }: any) {
  const { state, act, open, busy } = useApp();
  const [cin, setCin] = useState(a?.clockIn || ""),
    [cout, setCout] = useState(a?.clockOut || ""),
    [breakMinutes, setBreak] = useState(
      a?.breakMinutes ??
        state.shifts.find((s: any) => s.id === w.shiftId)?.breakMinutes ??
        0,
    );
  const locked = !!a && isLocked(state, a);
  const shifts = state.shifts.filter(
    (s: any) => s.companyId === w.companyId && s.status === "Active",
  );
  const sh = state.shifts.find(
    (s: any) => s.id === (a ? a.shiftId : w.shiftId),
  );
  async function save() {
    await act(
      "saveEntity",
      {
        entity: "attendance",
        value: {
          ...a,
          id: a?.id || crypto.randomUUID(),
          companyId: w.companyId,
          siteId: a?.siteId || sh?.siteId || w.siteId,
          workerId: w.id,
          shiftId: a ? a.shiftId : w.shiftId,
          date: workDate,
          clockIn: cin,
          clockOut: cout,
          breakMinutes,
          rate: a?.rate ?? w.rate,
          notes: a?.notes || "Entered directly from worker list",
          reviewNote: a?.reviewNote || "",
          sourceId: a?.sourceId || "",
          shiftStart: sh ? a?.shiftStart || sh.start : cin,
          shiftEnd: sh ? a?.shiftEnd || sh.end : cout,
        },
      },
      "Punch times saved",
    );
  }
  return (
    <tr>
      <td>
        <Person name={w.name} code={w.code} />
        <small>{w.deletedAt ? "Deleted" : w.status}</small>
      </td>
      <td>
        {state.companies.find((c: any) => c.id === w.companyId)?.name}
        <small>{money(w.rate)} / hour</small>
      </td>
      <td>
        {w.deletedAt ? (
          <span>—</span>
        ) : (
          <div>
            <select
              className="rowSelect"
              aria-label={"Time entry mode for " + w.name}
              disabled={busy}
              value={w.shiftId ? "assigned" : "manual"}
              onChange={(e) => {
                const shift = e.target.value === "assigned" ? shifts[0] : null;
                act(
                  "saveEntity",
                  {
                    entity: "workers",
                    value: {
                      ...w,
                      shiftId: shift?.id || "",
                      siteId: shift?.siteId || w.siteId,
                    },
                  },
                  "Time entry mode saved",
                );
              }}
            >
              <option value="assigned" disabled={!shifts.length}>
                Assigned shift
              </option>
              <option value="manual">Manually entered</option>
            </select>
            {w.shiftId ? (
              <select
                className="rowSelect"
                aria-label={"Assigned shift for " + w.name}
                disabled={busy}
                value={w.shiftId}
                onChange={(e) =>
                  act(
                    "saveEntity",
                    {
                      entity: "workers",
                      value: {
                        ...w,
                        shiftId: e.target.value,
                        siteId:
                          shifts.find((s: any) => s.id === e.target.value)
                            ?.siteId || w.siteId,
                      },
                    },
                    "Shift assignment saved",
                  )
                }
              >
                {!shifts.some((s: any) => s.id === w.shiftId) && (
                  <option value={w.shiftId}>
                    {state.shifts.find((s: any) => s.id === w.shiftId)?.name ||
                      "Previous shift"}{" "}
                    (inactive)
                  </option>
                )}
                {shifts.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.start}–{s.end}
                  </option>
                ))}
              </select>
            ) : (
              <small>Enter punch in and punch out directly.</small>
            )}
            {a && a.shiftId !== w.shiftId && (
              <small>
                Assignment applies to new records. This date keeps its saved
                shift.
              </small>
            )}
          </div>
        )}
        {!w.deletedAt && sh && !locked && (
          <Button
            variant="text"
            onClick={() => {
              setCin(sh.start);
              setCout(sh.end);
              setBreak(sh.breakMinutes);
            }}
          >
            Use shift times
          </Button>
        )}
      </td>
      <td>
        <input
          className="rowTime"
          aria-label={"Punch in for " + w.name}
          type="time"
          value={cin}
          disabled={busy || locked || !!w.deletedAt}
          onInput={(e) => setCin(e.currentTarget.value)}
          onChange={(e) => setCin(e.target.value)}
        />
      </td>
      <td>
        <input
          className="rowTime"
          aria-label={"Punch out for " + w.name}
          type="time"
          value={cout}
          disabled={busy || locked || !!w.deletedAt}
          onInput={(e) => setCout(e.currentTarget.value)}
          onChange={(e) => setCout(e.target.value)}
        />
      </td>
      <td>
        <input
          className="rowBreak"
          aria-label={"Break minutes for " + w.name}
          type="number"
          min={0}
          max={720}
          value={breakMinutes}
          disabled={busy || locked || !!w.deletedAt}
          onChange={(e) => setBreak(Number(e.target.value))}
        />
      </td>
      <td>
        {locked ? (
          <Badge tone="gray">Payroll locked</Badge>
        ) : (
          !w.deletedAt && (
            <Button
              variant="secondary"
              disabled={
                busy || !workDate || (!cin && !cout) || (!sh && (!cin || !cout))
              }
              onClick={save}
            >
              Save times
            </Button>
          )
        )}
      </td>
      <td>
        <div className="buttonRow">
          {w.deletedAt ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                act("restoreWorker", { id: w.id }, "Worker restored")
              }
            >
              Restore
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                aria-label={"Edit " + w.name}
                onClick={() => open("workers", w)}
              >
                <Pencil size={14} /> Edit
              </Button>
              <Button
                variant="dangerText"
                aria-label={"Delete " + w.name}
                onClick={() => open("deleteWorker", w)}
              >
                <Trash2 size={14} /> Delete
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
function AttendanceTimeInputs({ record: a }: any) {
  const { act, busy } = useApp();
  const [cin, setCin] = useState(a.clockIn),
    [cout, setCout] = useState(a.clockOut);
  const locked = isLocked(useApp().state, a),
    dirty = cin !== a.clockIn || cout !== a.clockOut;
  return (
    <div className="attendanceTimeInputs">
      <div>
        <input
          aria-label={"Clock in " + a.date + " " + a.id}
          className="rowTime"
          type="time"
          value={cin}
          disabled={busy || locked}
          onInput={(e) => setCin(e.currentTarget.value)}
          onChange={(e) => setCin(e.target.value)}
        />
        <span>→</span>
        <input
          aria-label={"Clock out " + a.date + " " + a.id}
          className="rowTime"
          type="time"
          value={cout}
          disabled={busy || locked}
          onInput={(e) => setCout(e.currentTarget.value)}
          onChange={(e) => setCout(e.target.value)}
        />
      </div>
      {dirty && (
        <Button
          variant="secondary"
          disabled={busy || locked}
          onClick={() =>
            act(
              "saveEntity",
              {
                entity: "attendance",
                value: {
                  ...a,
                  clockIn: cin,
                  clockOut: cout,
                  ...(!a.shiftId
                    ? {
                        shiftStart: cin || a.shiftStart,
                        shiftEnd: cout || a.shiftEnd,
                      }
                    : {}),
                },
              },
              "Clock times updated; original times retained",
            )
          }
        >
          Save clock times
        </Button>
      )}
      <small>
        {a.breakMinutes} min break{locked ? " · Finalized payroll" : ""}
      </small>
    </div>
  );
}

function Shifts() {
  const { state, scoped, open } = useApp();
  const shifts = scoped(state.shifts);
  return (
    <>
      <div className="sectionTop">
        <div>
          <h2>Shifts that fit your teams</h2>
          <p>
            Same-day and overnight shifts supported. Unpaid breaks are deducted
            from payable hours.
          </p>
        </div>
        <Button
          disabled={!state.companies.length}
          onClick={() => open("shifts")}
        >
          <Plus size={16} /> Add shift
        </Button>
      </div>
      <div className="shiftGrid">
        {shifts.map((s: any) => (
          <Card key={s.id}>
            <div className="shiftCard">
              <div className="shiftCardTop">
                <span className="largeIcon">
                  <Clock3 size={22} />
                </span>
                <Badge tone={s.status === "Active" ? "green" : "gray"}>
                  {s.status}
                </Badge>
              </div>
              <h3>{s.name}</h3>
              <p>
                {state.companies.find((c: any) => c.id === s.companyId)?.name}
              </p>
              <div className="shiftTimes">
                <div>
                  <small>SHIFT START</small>
                  <strong>{s.start}</strong>
                </div>
                <ArrowRight size={20} />
                <div>
                  <small>SHIFT END {s.end < s.start ? "(+1 DAY)" : ""}</small>
                  <strong>{s.end}</strong>
                </div>
              </div>
              <div className="shiftDetails">
                <span>
                  <MapPin size={14} />
                  {state.sites.find((p: any) => p.id === s.siteId)?.name ||
                    "All company properties"}
                </span>
                <span>
                  <Clock3 size={14} />
                  {s.breakMinutes} minute unpaid break
                </span>
              </div>
              <Button
                variant="secondary full"
                onClick={() => open("shifts", s)}
              >
                Edit shift <Pencil size={14} />
              </Button>
            </div>
          </Card>
        ))}
        {!shifts.length && (
          <Card>
            <Empty
              title="Create a shift"
              description="Set working times and break durations for each company."
            />
          </Card>
        )}
      </div>
    </>
  );
}
function AttendanceTable({ rows, editable = false }: any) {
  const { state, open } = useApp();
  return (
    <Table
      headers={[
        "Worker",
        "Work date / shift",
        "Actual in → out",
        "Adjusted in → out",
        "Payable hours",
        "Wages",
        "Review",
        ...(editable ? [""] : []),
      ]}
      empty={!rows.length}
      emptyText="No attendance for this selection. Add a record or import a document."
    >
      {rows.map((a: any) => {
        const w = state.workers.find((w: any) => w.id === a.workerId),
          c = calculate(a),
          locked = isLocked(state, a),
          issues = blockingIssues(a);
        return (
          <tr key={a.id}>
            <td>
              <Person name={w?.name || "Unknown worker"} code={w?.code} />
            </td>
            <td>
              {displayDate(a.date)}
              <small>
                {state.shifts.find((s: any) => s.id === a.shiftId)?.name}
              </small>
            </td>
            <td className="mono">
              {editable ? (
                <AttendanceTimeInputs key={a.id + a.updatedAt} record={a} />
              ) : (
                <>
                  {a.clockIn || "—"} <span className="arrow">→</span>{" "}
                  {a.clockOut || "—"}
                  <small>{a.breakMinutes} min break</small>
                </>
              )}
            </td>
            <td className="mono">
              {clock(c.adjustedIn)} <span className="arrow">→</span>{" "}
              {clock(c.adjustedOut)}
            </td>
            <td>
              <b>{c.hours.toFixed(2)} h</b>
              <small>{c.otHours.toFixed(2)} h overtime</small>
            </td>
            <td>
              <b>{money(c.total)}</b>
            </td>
            <td>
              {locked ? (
                <Badge tone="gray">
                  <LockKeyhole size={10} /> Locked
                </Badge>
              ) : issues.length ? (
                <Badge tone="amber">
                  {issues.length} issue{issues.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge tone="green">Ready</Badge>
              )}
            </td>
            {editable && (
              <td>
                <Button
                  variant="icon"
                  aria-label={"View attendance for " + w?.name + " " + a.date}
                  onClick={() => open("attendance", a)}
                >
                  <Pencil size={15} />
                </Button>
              </td>
            )}
          </tr>
        );
      })}
    </Table>
  );
}
function Attendance() {
  const { state, scoped, month, open, companyId, setError } = useApp();
  const [query, setQuery] = useState(""),
    [flagOnly, setFlagOnly] = useState(false);
  const rows = scoped(state.attendance)
    .filter(
      (a: any) =>
        a.date.startsWith(month) && (!flagOnly || blockingIssues(a).length > 0),
    )
    .filter((a: any) => {
      const w = state.workers.find((w: any) => w.id === a.workerId);
      return ((w?.name || "") + " " + (w?.code || ""))
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .sort((a: any, b: any) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="infoStrip">
        <ShieldCheck size={20} />
        <div>
          <b>Original records stay intact</b>
          <p>
            Every record retains its original times, rate, and policy. Finalized
            payroll locks its source attendance.
          </p>
        </div>
      </div>
      <Card
        title="Attendance register"
        description="Working hours only. Transparent rounding and break deductions."
        action={
          <div className="buttonRow">
            <Button
              variant="secondary"
              onClick={() =>
                exportWorkbook(state, companyId, month).catch((e: any) =>
                  setError(e.message),
                )
              }
            >
              <Download size={15} /> Excel
            </Button>
            <Button
              disabled={!state.workers.filter((w: any) => !w.deletedAt).length}
              onClick={() => open("attendance")}
            >
              <Plus size={16} /> Add attendance
            </Button>
          </div>
        }
      >
        <div className="tableToolbar">
          <div className="searchBar">
            <Search size={16} />
            <input
              aria-label="Search attendance"
              placeholder="Search worker name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={flagOnly}
              onChange={(e) => setFlagOnly(e.target.checked)}
            />{" "}
            Needs review only
          </label>
          <span>{rows.length} records</span>
        </div>
        <AttendanceTable rows={rows} editable />
      </Card>
    </>
  );
}
function Hours() {
  const { state, companyId } = useApp();
  const c =
    state.companies.find((c: any) => c.id === companyId) || state.companies[0];
  const [selected, setSelected] = useState(""),
    [f, setF] = useState({
      clockIn: "07:33",
      clockOut: "19:27",
      shiftStart: "07:30",
      shiftEnd: "19:30",
      breakMinutes: 60,
      rate: 10,
      policy: { ...defaultPolicy },
    });
  useEffect(() => {
    if (c) setF((x) => ({ ...x, policy: { ...c.policy } }));
  }, [c?.id]);
  const result = calculate(f);
  const change = (key: string, val: any) => setF({ ...f, [key]: val });
  return (
    <div className="calculatorGrid">
      <Card
        title="Working hours calculator"
        description="An interactive preview. This does not create an attendance record."
      >
        <div className="cardBody">
          <Field label="Use a company shift">
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                const s = state.shifts.find(
                  (s: any) => s.id === e.target.value,
                );
                if (s) {
                  const company = state.companies.find(
                    (c: any) => c.id === s.companyId,
                  );
                  setF({
                    ...f,
                    shiftStart: s.start,
                    shiftEnd: s.end,
                    breakMinutes: s.breakMinutes,
                    policy: { ...company.policy },
                  });
                }
              }}
            >
              <option value="">Custom shift</option>
              {state.shifts.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {state.companies.find((c: any) => c.id === s.companyId)?.name}{" "}
                  · {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="formGrid">
            {[
              ["Shift start", "shiftStart", "time"],
              ["Shift end", "shiftEnd", "time"],
              ["Actual clock-in", "clockIn", "time"],
              ["Actual clock-out", "clockOut", "time"],
              ["Unpaid break (min)", "breakMinutes", "number"],
              ["Hourly rate (RM)", "rate", "number"],
            ].map(([label, key, type]) => (
              <Field
                key={key}
                label={label}
                type={type}
                min={0}
                max={key === "breakMinutes" ? 720 : undefined}
                step={key === "rate" ? 0.01 : 1}
                value={(f as any)[key]}
                onChange={(e: any) =>
                  change(
                    key,
                    type === "number"
                      ? Math.max(0, Number(e.target.value))
                      : e.target.value,
                  )
                }
              />
            ))}
            {[
              ["Grace period (min)", "grace"],
              ["Rounding interval (min)", "interval"],
              ["Regular hours per day", "dailyRegularHours"],
              ["Overtime multiplier", "otMultiplier"],
            ].map(([l, k]) => (
              <Field
                key={k}
                label={l}
                type="number"
                min={k === "grace" ? 0 : 1}
                max={k === "interval" ? 120 : 60}
                step={k === "otMultiplier" ? 0.1 : 1}
                value={(f.policy as any)[k]}
                onChange={(e: any) =>
                  setF({
                    ...f,
                    policy: {
                      ...f.policy,
                      [k]: Math.max(
                        k === "grace" ? 0 : 1,
                        Number(e.target.value),
                      ),
                    },
                  })
                }
              />
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={f.policy.outsideShift}
              onChange={(e) =>
                setF({
                  ...f,
                  policy: { ...f.policy, outsideShift: e.target.checked },
                })
              }
            />{" "}
            Count time outside scheduled shift
          </label>
        </div>
      </Card>
      <div>
        <Card className="calculationResult">
          <div className="cardBody">
            <div className="eyebrow">YOUR CALCULATED WORKING HOURS</div>
            <strong className="bigHours">
              {result.hours.toFixed(2)} <span>hours</span>
            </strong>
            <p>After rounding and unpaid break deduction</p>
            <div className="resultTimes">
              <div>
                <small>CALCULATED CLOCK-IN</small>
                <b>{clock(result.adjustedIn)}</b>
              </div>
              <ArrowRight size={20} />
              <div>
                <small>CALCULATED CLOCK-OUT</small>
                <b>{clock(result.adjustedOut)}</b>
              </div>
            </div>
            <dl className="breakdown">
              <div>
                <dt>Recorded duration</dt>
                <dd>{result.rawHours.toFixed(2)} h</dd>
              </div>
              <div>
                <dt>Regular working hours</dt>
                <dd>{result.regularHours.toFixed(2)} h</dd>
              </div>
              <div>
                <dt>Overtime hours</dt>
                <dd>{result.otHours.toFixed(2)} h</dd>
              </div>
              <div>
                <dt>Regular wages</dt>
                <dd>{money(result.regularPay)}</dd>
              </div>
              <div>
                <dt>Overtime wages</dt>
                <dd>{money(result.otPay)}</dd>
              </div>
              <div className="total">
                <dt>Total estimated wages</dt>
                <dd>{money(result.total)}</dd>
              </div>
            </dl>
            {result.errors.length > 0 && (
              <p className="warningText">{result.errors.join(" · ")}</p>
            )}
          </div>
        </Card>
        <Card title="Your five-minute rule, explained">
          <div className="cardBody ruleExamples">
            <div>
              <span>Clock in at 07:33</span>
              <b>07:30</b>
            </div>
            <div>
              <span>Clock in at 07:36</span>
              <b>08:00</b>
            </div>
            <div>
              <span>Clock out at 19:27</span>
              <b>19:30</b>
            </div>
            <div>
              <span>Clock out at 19:20</span>
              <b>19:00</b>
            </div>
            <p>
              Examples use a 07:30–19:30 shift, 5-minute tolerance, and
              30-minute intervals. Overnight shifts use the following day’s end
              time.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
function Scanner() {
  const {
    state,
    apiUrl,
    companyId,
    act,
    busy,
    setError,
    setFiles,
    files,
    open,
    setToast,
  } = useApp();
  const [cid, setCid] = useState(companyId || state.companies[0]?.id || ""),
    [shiftId, setShiftId] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [processing, setProcessing] = useState(false),
    [progress, setProgress] = useState(""),
    [raw, setRaw] = useState(""),
    [rows, setRows] = useState<ImportRow[]>([]),
    [sourceId, setSourceId] = useState(""),
    [method, setMethod] = useState(""),
    [rawOpen, setRawOpen] = useState(false);
  const shifts = state.shifts.filter(
    (s: any) => s.companyId === cid && s.status === "Active",
  );
  const shift = shifts.find((s: any) => s.id === shiftId);
  const checked = validateImport(rows, state, cid),
    valid = checked.filter((r) => !r.issues.length);
  async function scan() {
    if (!file || !shift) {
      setError("Choose a company, shift, and source file first.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Maximum file size is 15 MB");
      return;
    }
    setProcessing(true);
    setError("");
    setSourceId("");
    try {
      setProgress("Preserving original source…");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/files"), {
          method: "POST",
          body: form,
        }),
        saved: any = await res.json();
      if (!res.ok) throw Error(saved.error);
      setSourceId(saved.id);
      setFiles((f: any) => [saved, ...f]);
      const output = await extractFile(file, shift.breakMinutes, setProgress);
      setRows(output.rows);
      setRaw(output.text);
      setRawOpen(output.rows.length === 0);
      setMethod(output.method);
      setProgress("Extraction complete");
      if (!output.rows.length)
        setToast("Source saved. Check extracted text or add rows manually.");
    } catch (e: any) {
      setError(
        e.message ||
          "Document could not be scanned. You can enter rows manually.",
      );
    } finally {
      setProcessing(false);
    }
  }
  function update(i: number, key: string, value: any) {
    setRows((old) => old.map((r, j) => (i === j ? { ...r, [key]: value } : r)));
  }
  async function commit() {
    if (!shift) {
      setError("Choose a shift");
      return;
    }
    const result = await act(
      "importAttendance",
      {
        sourceId,
        rows: valid.map((r) => {
          const w = state.workers.find(
            (w: any) =>
              w.companyId === cid &&
              w.code.toLowerCase() === r.workerCode.toLowerCase(),
          );
          return {
            workerId: w.id,
            companyId: cid,
            siteId: shift.siteId || w.siteId,
            shiftId: shift.id,
            date: r.date,
            clockIn: r.clockIn,
            clockOut: r.clockOut,
            breakMinutes: r.breakMinutes,
            notes: "Imported from " + (file?.name || "review table"),
            reviewNote: "",
          };
        }),
      },
      `${valid.length} attendance records imported`,
    );
    if (result) {
      const remaining = checked.filter((r) => r.issues.length);
      setRows(remaining);
      if (!remaining.length) setRaw("");
      setFiles((fs: any) =>
        fs.map((f: any) =>
          f.id === sourceId ? { ...f, rows: f.rows + valid.length } : f,
        ),
      );
      if (!remaining.length) setSourceId("");
    }
  }
  return (
    <>
      <div className="importSteps">
        <div className="active">
          <span>1</span>
          <div>
            <b>Upload a document</b>
            <small>Excel, PDF or punch-card image</small>
          </div>
        </div>
        <ChevronRight size={17} />
        <div className={rows.length ? "active" : ""}>
          <span>2</span>
          <div>
            <b>Review extracted records</b>
            <small>Correct any scanning errors</small>
          </div>
        </div>
        <ChevronRight size={17} />
        <div>
          <span>3</span>
          <div>
            <b>Save attendance</b>
            <small>Calculate payable hours</small>
          </div>
        </div>
      </div>
      <div className="importGrid">
        <Card
          title="Attendance document"
          description="Original files are securely retained with your attendance."
        >
          <div className="cardBody">
            <div className="formGrid">
              <Field label="Company">
                <select
                  aria-label="Import company"
                  value={cid}
                  onChange={(e) => {
                    setCid(e.target.value);
                    setShiftId("");
                    setRows([]);
                  }}
                >
                  <option value="">Select company</option>
                  {state.companies
                    .filter((c: any) => c.status === "Active")
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Shift for imported records">
                <select
                  aria-label="Import shift"
                  value={shiftId}
                  onChange={(e) => {
                    setShiftId(e.target.value);
                    setRows([]);
                  }}
                >
                  <option value="">Select shift</option>
                  {shifts.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start}–{s.end})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="dropzone">
              <span className="uploadIcon">
                <UploadCloud size={28} />
              </span>
              <b>{file ? file.name : "Choose your attendance file"}</b>
              <p>Excel & CSV · PDF · PNG, JPG & WebP</p>
              <small>
                Maximum 15 MB · PDF up to 20 pages; scanned PDFs up to 5 pages
              </small>
              <input
                aria-label="Attendance source file"
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setRows([]);
                  setSourceId("");
                }}
              />
            </label>
            <Button
              variant="full"
              disabled={!file || !shift || processing}
              onClick={scan}
            >
              {processing ? (
                <RefreshCw size={17} className="spin" />
              ) : (
                <ScanLine size={17} />
              )}{" "}
              {processing ? progress : "Extract attendance"}
            </Button>
            {progress && !processing && (
              <p className="subtleText">
                {progress} {method && "· " + method}
              </p>
            )}
            <Button
              variant="text templateLink"
              onClick={() =>
                importTemplate().catch((e: any) => setError(e.message))
              }
            >
              <Download size={15} /> Download Excel import template
            </Button>
          </div>
        </Card>
        <Card
          title="A good scan starts with a clear source"
          description="Built for real payroll documents."
        >
          <div className="cardBody scanTips">
            <div>
              <span>
                <FileText size={20} />
              </span>
              <div>
                <b>Excel or CSV</b>
                <p>
                  Use Worker ID, Date, Clock In, Clock Out, and Break Minutes
                  columns. The first worksheet is imported.
                </p>
              </div>
            </div>
            <div>
              <span>
                <ScanLine size={20} />
              </span>
              <div>
                <b>PDFs & punch cards</b>
                <p>
                  Text is extracted locally. Images and scanned PDFs use
                  on-device OCR. No document is sent to an external recognition
                  service.
                </p>
              </div>
            </div>
            <div>
              <span>
                <ClipboardCheck size={20} />
              </span>
              <div>
                <b>Always review before saving</b>
                <p>
                  Recognition varies by layout and image quality. Correct worker
                  IDs and dates in the table. Duplicate or invalid rows cannot
                  be imported.
                </p>
              </div>
            </div>
            <div className="note">
              For text recognition, one row per shift works best:
              <br />
              <code>TW-001 2026-11-17 07:33 19:27</code>
              <br />
              For nonstandard punch-card layouts, copy the recognized times into
              the review table.
            </div>
          </div>
        </Card>
      </div>
      <Card
        title="Review extracted attendance"
        description={`${rows.length} extracted rows · ${valid.length} ready to import · ${rows.length - valid.length} need correction`}
        action={
          <div className="buttonRow">
            <Button
              variant="secondary"
              disabled={!shift}
              onClick={() =>
                setRows([
                  ...rows,
                  {
                    workerCode: "",
                    date: today(),
                    clockIn: "",
                    clockOut: "",
                    breakMinutes: shift?.breakMinutes || 0,
                    issues: [],
                  },
                ])
              }
            >
              <Plus size={15} /> Add row
            </Button>
            <Button
              disabled={!valid.length || processing || busy}
              onClick={commit}
            >
              <Check size={16} /> Import {valid.length} valid rows
            </Button>
          </div>
        }
      >
        {raw && (
          <div className="rawSection">
            <Button variant="text" onClick={() => setRawOpen(!rawOpen)}>
              {rawOpen ? "Hide" : "Show"} recognized text
            </Button>
            {rawOpen && (
              <>
                <textarea
                  aria-label="Recognized document text"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={7}
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    setRows(textRows(raw, shift?.breakMinutes || 0))
                  }
                >
                  Rebuild rows from text
                </Button>
              </>
            )}
          </div>
        )}
        <Table
          headers={[
            "Worker ID",
            "Date",
            "Clock in",
            "Clock out",
            "Break (min)",
            "Validation",
            "",
          ]}
          empty={!rows.length}
          emptyText="Upload a source file to extract rows, or choose a shift and add rows manually."
        >
          {checked.map((r, i) => (
            <tr key={i} className="importRow">
              <td>
                <input
                  aria-label={`Worker ID row ${i + 1}`}
                  value={r.workerCode}
                  onChange={(e) => update(i, "workerCode", e.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`Date row ${i + 1}`}
                  type="date"
                  value={r.date}
                  onChange={(e) => update(i, "date", e.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`Clock in row ${i + 1}`}
                  type="time"
                  value={r.clockIn}
                  onChange={(e) => update(i, "clockIn", e.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`Clock out row ${i + 1}`}
                  type="time"
                  value={r.clockOut}
                  onChange={(e) => update(i, "clockOut", e.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`Break row ${i + 1}`}
                  type="number"
                  min={0}
                  value={r.breakMinutes}
                  onChange={(e) =>
                    update(i, "breakMinutes", Number(e.target.value))
                  }
                />
              </td>
              <td>
                {r.issues.length ? (
                  <span className="rowIssue">{r.issues.join(" · ")}</span>
                ) : (
                  <Badge tone="green">
                    <Check size={11} /> Ready
                  </Badge>
                )}
              </td>
              <td>
                <Button
                  variant="icon"
                  aria-label={`Remove row ${i + 1}`}
                  onClick={() => setRows(rows.filter((_, j) => i !== j))}
                >
                  <X size={15} />
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card
        title="Source document archive"
        description="Download the original file at any time."
      >
        <Table
          headers={["File", "Uploaded", "Size", "Imported records", ""]}
          empty={!files.length}
        >
          {files.map((f: any) => (
            <tr key={f.id}>
              <td>
                <div className="fileName">
                  <FileText size={19} />
                  <b>{f.name}</b>
                </div>
              </td>
              <td>{displayDate(f.createdAt)}</td>
              <td>{(f.size / 1024).toFixed(1)} KB</td>
              <td>{f.rows}</td>
              <td>
                <a
                  className="btn secondary"
                  href={apiUrl("/api/files?id=" + encodeURIComponent(f.id))}
                  download
                >
                  <Download size={14} /> Original
                </a>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
function RunStatus({ run }: any) {
  return (
    <Badge
      tone={
        run.status === "Paid"
          ? "green"
          : run.status === "Draft"
            ? "amber"
            : run.status === "Cancelled"
              ? "gray"
              : "blue"
      }
    >
      {run.status}
    </Badge>
  );
}
function Payroll({ history = false }: any) {
  const {
    state,
    scoped,
    open,
    month,
    setSelectedRun,
    navigate,
    companyId,
    setError,
  } = useApp();
  const [status, setStatus] = useState(""),
    [query, setQuery] = useState("");
  const rows = scoped(state.runs)
    .filter((r: any) =>
      history
        ? ["Finalized", "Paid"].includes(r.status)
        : r.status !== "Cancelled",
    )
    .filter(
      (r: any) =>
        (!history ||
          (r.start.slice(0, 7) <= month && r.end.slice(0, 7) >= month)) &&
        (!status || r.status === status) &&
        (
          r.companyName +
          " " +
          r.start +
          " " +
          r.end +
          " " +
          r.rows.map((w: any) => w.name + " " + w.code).join(" ")
        )
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const finalized = rows.filter((r: any) => r.status === "Finalized"),
    paid = rows.filter((r: any) => r.status === "Paid"),
    sum = (list: any[]) =>
      list.reduce(
        (n, r) => n + r.rows.reduce((n: number, w: any) => n + w.net, 0),
        0,
      );
  return (
    <>
      <div className="statsGrid three">
        <Stat
          label={history ? "Payroll records" : "In preparation"}
          value={
            history
              ? rows.length
              : rows.filter((r: any) => r.status === "Draft").length
          }
          description={
            history
              ? "Finalized and paid runs in selected month"
              : "Draft runs awaiting verification"
          }
          icon={ClipboardCheck}
        />
        <Stat
          label="Awaiting payment"
          value={money(sum(finalized))}
          description={`${finalized.length} finalized payroll runs`}
          icon={Wallet}
        />
        <Stat
          label="Recorded as paid"
          value={money(sum(paid))}
          description={`${paid.length} paid payroll runs`}
          icon={CheckCircle2}
        />
      </div>
      <Card
        title={history ? "Payroll history" : "Company payroll runs"}
        description={
          history
            ? "Immutable payroll snapshots, organized by company and period."
            : "Prepare a draft, review each worker, and finalize when everything is correct."
        }
        action={
          !history && (
            <Button
              disabled={!state.attendance.length}
              onClick={() => open("run")}
            >
              <Plus size={16} /> Create payroll draft
            </Button>
          )
        }
      >
        <div className="tableToolbar">
          <div className="searchBar">
            <Search size={16} />
            <input
              aria-label="Search payroll runs"
              placeholder="Search company, worker or period…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Payroll status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {(history
              ? ["Finalized", "Paid"]
              : ["Draft", "Finalized", "Paid"]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <Table
          headers={[
            "Company & period",
            "Workers",
            "Hours",
            "Gross pay",
            "Deductions",
            "Net pay",
            "Status",
            "",
          ]}
          empty={!rows.length}
          emptyText={
            history
              ? "No finalized payroll in this month."
              : "Create a payroll draft from attendance records to begin."
          }
        >
          {rows.map((r: any) => (
            <tr key={r.id}>
              <td>
                <b>{r.companyName}</b>
                <small>
                  {displayDate(r.start)} — {displayDate(r.end)}
                </small>
              </td>
              <td>{r.rows.length}</td>
              <td>
                {r.rows
                  .reduce(
                    (n: number, w: any) => n + w.regularHours + w.otHours,
                    0,
                  )
                  .toFixed(2)}{" "}
                h
              </td>
              <td>
                {money(r.rows.reduce((n: number, w: any) => n + w.gross, 0))}
              </td>
              <td>
                {money(
                  r.rows.reduce((n: number, w: any) => n + w.deduction, 0),
                )}
              </td>
              <td>
                <b>
                  {money(r.rows.reduce((n: number, w: any) => n + w.net, 0))}
                </b>
              </td>
              <td>
                <RunStatus run={r} />
              </td>
              <td>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedRun(r.id);
                    navigate("Payroll verification");
                  }}
                >
                  View {r.status === "Draft" ? "& verify" : ""}
                  <ArrowUpRight size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="note">
        <ShieldCheck size={17} />
        <p>
          Overtime uses the daily threshold and multiplier saved with each
          attendance record. Allowances and applicable deductions are entered by
          payroll staff; statutory rates are not assumed. Marking a run paid
          records your payment—it does not transfer money.
        </p>
      </div>
    </>
  );
}
function Verification() {
  const {
    state,
    scoped,
    selectedRun,
    setSelectedRun,
    act,
    busy,
    open,
    setError,
  } = useApp();
  const runs = scoped(state.runs).filter((r: any) => r.status !== "Cancelled");
  const run: Run | undefined =
    runs.find((r: any) => r.id === selectedRun) || runs[0];
  if (!run)
    return (
      <Card>
        <Empty
          title="No payroll to verify yet"
          description="Create a draft in Payroll calculator, then return here to review and finalize."
          icon={ClipboardCheck}
        />
      </Card>
    );
  const ats = selectedAttendance(state, run.companyId, run.start, run.end),
    changed = fingerprint(ats) !== run.fingerprint,
    issues = ats.flatMap((a) => blockingIssues(a)),
    totals = run.rows.reduce(
      (n, w) => ({
        gross: n.gross + w.gross,
        net: n.net + w.net,
        ot: n.ot + w.otPay,
        deductions: n.deductions + w.deduction,
      }),
      { gross: 0, net: 0, ot: 0, deductions: 0 },
    );
  return (
    <>
      <div className="verificationSelector">
        <label>
          Payroll run
          <select
            aria-label="Select payroll run"
            value={run.id}
            onChange={(e) => setSelectedRun(e.target.value)}
          >
            {runs.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.companyName} · {r.start} – {r.end} · {r.status}
              </option>
            ))}
          </select>
        </label>
        <RunStatus run={run} />
      </div>
      <div className="reviewHero">
        <div>
          <div className="eyebrow">PAYROLL VERIFICATION</div>
          <h2>{run.companyName}</h2>
          <p>
            {displayDate(run.start)} — {displayDate(run.end)} ·{" "}
            {run.rows.length} workers
          </p>
          <small>
            Prepared by {run.createdBy} · {displayDate(run.createdAt)}
          </small>
        </div>
        <div>
          <small>TOTAL NET PAY</small>
          <strong>{money(totals.net)}</strong>
          <span>
            {run.status === "Draft"
              ? "Review before finalizing"
              : "Verified payroll snapshot"}
          </span>
        </div>
      </div>
      {run.status === "Draft" && (changed || issues.length > 0) && (
        <div className="attentionStrip">
          <AlertTriangle size={21} />
          <div>
            <b>
              {changed
                ? "Attendance changed since this draft was created"
                : `${issues.length} attendance issue(s) must be resolved`}
            </b>
            <p>
              {changed
                ? "Refresh the draft, then review allowances and deductions again. Refreshing resets adjustments."
                : "Open Error detection to correct missing times or review unusual hours."}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => open("refreshRun", run)}
          >
            Refresh draft
          </Button>
        </div>
      )}
      <div className="statsGrid">
        <Stat
          label="Gross earnings"
          value={money(totals.gross)}
          description="Regular wages + overtime + allowances"
          icon={Wallet}
        />
        <Stat
          label="Overtime wages"
          value={money(totals.ot)}
          description="Using recorded company policies"
          icon={Clock3}
        />
        <Stat
          label="Deductions"
          value={money(totals.deductions)}
          description="Entered and reviewed by payroll staff"
          icon={Calculator}
        />
        <Stat
          label="Net payable"
          value={money(totals.net)}
          description={`${run.rows.length} worker payslips`}
          icon={FileText}
        />
      </div>
      <Card
        title="Worker-by-worker verification"
        description="Review earnings, explain any adjustments, then finalize."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              exportWorkbook(state, "", "", run).catch((e: any) =>
                setError(e.message),
              )
            }
          >
            <Download size={15} /> Excel report
          </Button>
        }
      >
        <Table
          headers={[
            "Worker",
            "Regular / OT hours",
            "Regular pay",
            "OT pay",
            "Allowances",
            "Deductions",
            "Net pay",
            "",
          ]}
          empty={!run.rows.length}
        >
          {run.rows.map((w) => (
            <tr key={w.workerId}>
              <td>
                <Person name={w.name} code={w.code} />
                {w.adjustmentNote && (
                  <small className="adjustmentNote">{w.adjustmentNote}</small>
                )}
              </td>
              <td>
                {w.regularHours.toFixed(2)} / {w.otHours.toFixed(2)} h
                <small>{w.days} shifts</small>
              </td>
              <td>{money(w.regularPay)}</td>
              <td>{money(w.otPay)}</td>
              <td>{money(w.allowance)}</td>
              <td>{money(w.deduction)}</td>
              <td>
                <b>{money(w.net)}</b>
              </td>
              <td>
                {run.status === "Draft" ? (
                  <Button
                    variant="secondary"
                    onClick={() => open("adjust", { ...w, runId: run.id })}
                  >
                    <Pencil size={13} /> Adjust
                  </Button>
                ) : (
                  <Button
                    variant="text"
                    onClick={() =>
                      exportPayslip(run, w.workerId).catch((e: any) =>
                        setError(e.message),
                      )
                    }
                  >
                    <FileText size={14} /> PDF payslip
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="verificationFooter">
        <div>
          <ShieldCheck size={20} />
          <p>
            {run.status === "Draft"
              ? "Finalizing locks these attendance records and preserves the verified payroll amounts."
              : `Finalized by ${run.finalizedBy} on ${displayDate(run.finalizedAt)}${run.status === "Paid" ? ` · Payment reference: ${run.paymentReference}` : ""}`}
          </p>
        </div>
        <div className="buttonRow">
          {run.status === "Draft" ? (
            <>
              <Button
                variant="dangerText"
                disabled={busy}
                onClick={() => open("cancelRun", run)}
              >
                Cancel draft
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => open("refreshRun", run)}
              >
                <RefreshCw size={15} /> Refresh draft
              </Button>
              <Button
                disabled={busy || changed || issues.length > 0}
                onClick={() => open("finalizeRun", run)}
              >
                <ShieldCheck size={16} /> Finalize payroll
              </Button>
            </>
          ) : run.status === "Finalized" ? (
            <Button onClick={() => open("payRun", run)}>
              <CheckCircle2 size={16} /> Record payment
            </Button>
          ) : (
            <Badge tone="green">
              <CheckCircle2 size={13} /> Paid {displayDate(run.paidAt)}
            </Badge>
          )}
        </div>
      </div>
    </>
  );
}
function Reports() {
  const { state, scoped, companyId, month, setError } = useApp();
  const rows = scoped(state.workers).map((w: any) => {
    const ats = state.attendance.filter(
        (a: any) => a.workerId === w.id && a.date.startsWith(month),
      ),
      cs = ats.map(calculate);
    return {
      ...w,
      days: ats.length,
      hours: cs.reduce((n: number, c: any) => n + c.hours, 0),
      ot: cs.reduce((n: number, c: any) => n + c.otHours, 0),
      wages: cs.reduce((n: number, c: any) => n + c.total, 0),
    };
  });
  const runs = scoped(state.runs).filter(
    (r: any) =>
      ["Finalized", "Paid"].includes(r.status) &&
      r.start.slice(0, 7) <= month &&
      r.end.slice(0, 7) >= month,
  );
  return (
    <>
      <div className="exportCards">
        <Card>
          <div className="exportCard">
            <span className="exportIcon excel">
              <FileBarChart2 size={26} />
            </span>
            <div>
              <h3>Attendance workbook</h3>
              <p>
                Actual & adjusted times, breaks, rates, regular hours, overtime,
                and source references.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                exportWorkbook(state, companyId, month).catch((e: any) =>
                  setError(e.message),
                )
              }
            >
              <Download size={15} /> Download Excel
            </Button>
          </div>
        </Card>
        <Card>
          <div className="exportCard">
            <span className="exportIcon pdf">
              <FileText size={26} />
            </span>
            <div>
              <h3>Payroll reports & payslips</h3>
              <p>
                Verified Excel payroll summaries and downloadable individual PDF
                payslips.
              </p>
            </div>
            <Badge>{runs.length} finalized runs</Badge>
          </div>
        </Card>
      </div>
      <Card
        title="Monthly worker summary"
        description="Attendance earnings before payroll-level allowances and deductions."
        action={
          <Badge>
            {rows.filter((w: any) => w.days).length} workers with shifts
          </Badge>
        }
      >
        <Table
          headers={[
            "Worker",
            "Company",
            "Shifts",
            "Regular hours",
            "Overtime",
            "Estimated wages",
          ]}
          empty={!rows.length}
        >
          {rows.map((w: any) => (
            <tr key={w.id}>
              <td>
                <Person name={w.name} code={w.code} />
              </td>
              <td>
                {state.companies.find((c: any) => c.id === w.companyId)?.name}
              </td>
              <td>{w.days}</td>
              <td>{(w.hours - w.ot).toFixed(2)} h</td>
              <td>{w.ot.toFixed(2)} h</td>
              <td>
                <b>{money(w.wages)}</b>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card
        title="Finalized payroll exports"
        description="Select a worker to download their PDF payslip."
      >
        {runs.length ? (
          runs.map((r: any) => (
            <div className="reportRun" key={r.id}>
              <div className="reportRunHead">
                <div>
                  <h3>{r.companyName}</h3>
                  <p>
                    {displayDate(r.start)} — {displayDate(r.end)}{" "}
                    <RunStatus run={r} />
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    exportWorkbook(state, "", "", r).catch((e: any) =>
                      setError(e.message),
                    )
                  }
                >
                  <Download size={15} /> Excel payroll
                </Button>
              </div>
              <div className="payslipLinks">
                {r.rows.map((w: any) => (
                  <Button
                    key={w.workerId}
                    variant="secondary"
                    onClick={() =>
                      exportPayslip(r, w.workerId).catch((e: any) =>
                        setError(e.message),
                      )
                    }
                  >
                    <FileText size={15} />
                    {w.name}
                    <Download size={12} />
                  </Button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="No finalized payroll to export"
            description="Finalize a payroll run to generate verified reports and PDF payslips."
          />
        )}
      </Card>
    </>
  );
}
function Errors() {
  const { state, companyId, month, scoped, open, navigate } = useApp();
  const [date, setDate] = useState(today()),
    [showResolved, setShowResolved] = useState(false);
  const all = anomalies(state, companyId, month),
    issues = all.filter((x: any) => showResolved || !x.resolved);
  const missing = scoped(state.workers).filter(
    (w: any) =>
      w.status === "Active" &&
      w.shiftId &&
      !state.attendance.some(
        (a: any) => a.workerId === w.id && a.date === date,
      ),
  );
  return (
    <>
      <div className="statsGrid three">
        <Stat
          label="Missing or invalid punches"
          value={
            all.filter((x: any) =>
              /Missing|identical|No payable|Break exceeds|Invalid/.test(
                x.message,
              ),
            ).length
          }
          description="Must be corrected before finalizing"
          icon={Clock3}
        />
        <Stat
          label="Unusual working hours"
          value={
            all.filter(
              (x: any) => x.message === "Unusual working hours" && !x.resolved,
            ).length
          }
          description="Review against each company’s threshold"
          icon={AlertTriangle}
        />
        <Stat
          label="Duplicate protection"
          value="Always on"
          description="Duplicate worker + date entries are blocked"
          icon={ShieldCheck}
        />
      </div>
      <Card
        title="Attendance review queue"
        description="Deterministic checks flag records for human review."
        action={
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />{" "}
            Include acknowledged
          </label>
        }
      >
        <Table
          headers={["Worker", "Date", "Issue", "Record", "Action"]}
          empty={!issues.length}
          emptyText="No issues found in recorded attendance for this selection."
        >
          {issues.map((x: any) => {
            const w = state.workers.find(
              (w: any) => w.id === x.attendance.workerId,
            );
            return (
              <tr key={x.id}>
                <td>
                  <Person name={w?.name} code={w?.code} />
                </td>
                <td>{displayDate(x.attendance.date)}</td>
                <td>
                  <Badge tone={x.resolved ? "green" : "amber"}>
                    {x.message}
                  </Badge>
                  {x.resolved && <small>{x.attendance.reviewNote}</small>}
                </td>
                <td>
                  {x.attendance.clockIn || "Missing"} →{" "}
                  {x.attendance.clockOut || "Missing"}
                </td>
                <td>
                  <Button
                    variant="secondary"
                    onClick={() => open("attendance", x.attendance)}
                  >
                    Review record <ArrowUpRight size={14} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card
        title="Workers without a record"
        description="An informational check for your selected date. Confirm who was actually expected to work."
        action={
          <input
            aria-label="Missing attendance check date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        }
      >
        <Table
          headers={["Worker", "Company", "Assigned shift", ""]}
          empty={!missing.length}
          emptyText="All active assigned workers have attendance for this date."
        >
          {missing.map((w: any) => (
            <tr key={w.id}>
              <td>
                <Person name={w.name} code={w.code} />
              </td>
              <td>
                {state.companies.find((c: any) => c.id === w.companyId)?.name}
              </td>
              <td>{state.shifts.find((s: any) => s.id === w.shiftId)?.name}</td>
              <td>
                <Button
                  variant="text"
                  onClick={() =>
                    open("attendance", {
                      workerId: w.id,
                      companyId: w.companyId,
                      siteId: w.siteId,
                      shiftId: w.shiftId,
                      date,
                    })
                  }
                >
                  <Plus size={14} /> Add attendance
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
function Policies() {
  const { state, companyId, open } = useApp();
  return (
    <>
      <div className="infoStrip">
        <SlidersHorizontal size={21} />
        <div>
          <b>Company-specific policies, preserved in every record</b>
          <p>
            Policy changes apply to new attendance. Existing records retain the
            rules used when they were created.
          </p>
        </div>
      </div>
      <div className="policyGrid">
        {state.companies
          .filter((c: any) => !companyId || c.id === companyId)
          .map((c: any) => (
            <Card
              key={c.id}
              title={c.name}
              description="Attendance & overtime configuration"
              action={
                <Button variant="text" onClick={() => open("policy", c)}>
                  <Pencil size={14} /> Edit rules
                </Button>
              }
            >
              <div className="cardBody">
                <dl className="breakdown">
                  <div>
                    <dt>Clock-in / clock-out tolerance</dt>
                    <dd>{c.policy.grace} minutes</dd>
                  </div>
                  <div>
                    <dt>Rounding interval</dt>
                    <dd>{c.policy.interval} minutes</dd>
                  </div>
                  <div>
                    <dt>Regular hours per day</dt>
                    <dd>{c.policy.dailyRegularHours} hours</dd>
                  </div>
                  <div>
                    <dt>Overtime rate multiplier</dt>
                    <dd>{c.policy.otMultiplier}×</dd>
                  </div>
                  <div>
                    <dt>Unusual duration threshold</dt>
                    <dd>{c.policy.maxHours} hours</dd>
                  </div>
                  <div>
                    <dt>Time outside scheduled shift</dt>
                    <dd>{c.policy.outsideShift ? "Included" : "Excluded"}</dd>
                  </div>
                </dl>
              </div>
            </Card>
          ))}
      </div>
      {!state.companies.length && (
        <Card>
          <Empty
            title="Add a company first"
            description="Attendance settings are managed separately for each company."
            action={
              <Button onClick={() => open("companies")}>Add company</Button>
            }
          />
        </Card>
      )}
      <div className="note">
        <ShieldCheck size={18} />
        <p>
          Configure company policies only after verifying the applicable
          employment terms. The app calculates the configured policy; it does
          not determine statutory rates or legal entitlement.
        </p>
      </div>
    </>
  );
}
function Audit() {
  const { audit } = useApp();
  return (
    <Card
      title="Workspace activity"
      description="The latest 200 events, including attendance edits, payroll adjustments, finalization, and payment records."
    >
      <Table
        headers={["When", "Activity", "Authorized user", "Details"]}
        empty={!audit.length}
      >
        {audit.map((a: any) => (
          <tr key={a.id}>
            <td>
              {new Date(a.createdAt).toLocaleString("en-MY", {
                timeZone: "Asia/Kuala_Lumpur",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </td>
            <td>
              <Badge>{a.action}</Badge>
            </td>
            <td>{a.actor}</td>
            <td className="wrapText">{a.detail}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
function Editor() {
  const {
    state,
    apiUrl,
    modal,
    setModal,
    open,
    companyId,
    month,
    act,
    busy,
    error,
    setError,
    setSelectedRun,
    navigate,
    files,
  } = useApp();
  const { kind, value } = modal;
  const c =
    state.companies.find(
      (c: any) => c.id === companyId && c.status === "Active",
    ) || state.companies.find((c: any) => c.status === "Active");
  function defaults() {
    const id = crypto.randomUUID(),
      companyId = value.companyId || c?.id || "";
    if (kind === "companies")
      return {
        id,
        name: "",
        registration: "",
        contact: "",
        email: "",
        address: "",
        status: "Active",
        policy: { ...defaultPolicy },
        ...value,
      };
    if (kind === "sites")
      return {
        id,
        companyId,
        name: "",
        type: "Warehouse",
        address: "",
        status: "Active",
        ...value,
      };
    if (kind === "shifts")
      return {
        id,
        companyId,
        siteId: "",
        name: "",
        start: "07:30",
        end: "19:30",
        breakMinutes: 60,
        status: "Active",
        ...value,
      };
    if (kind === "workers")
      return {
        id,
        companyId,
        siteId: "",
        shiftId: "",
        code: "TW-" + String(state.workers.length + 1).padStart(3, "0"),
        name: "",
        rate: 10,
        phone: "",
        bank: "",
        account: "",
        paymentMethod: "Bank transfer",
        status: "Active",
        ...value,
      };
    if (kind === "attendance") {
      const w =
        state.workers.find((w: any) => w.id === value.workerId) ||
        state.workers.find(
          (w: any) =>
            w.companyId === companyId && w.status === "Active" && !w.deletedAt,
        );
      const shift =
        state.shifts.find((s: any) => s.id === (value.shiftId || w?.shiftId)) ||
        state.shifts.find(
          (s: any) => s.companyId === companyId && s.status === "Active",
        );
      return {
        id,
        companyId,
        workerId: w?.id || "",
        siteId: value.siteId || shift?.siteId || w?.siteId || "",
        shiftId: shift?.id || "",
        shiftStart: shift?.start || "07:30",
        shiftEnd: shift?.end || "19:30",
        date: today(),
        clockIn: shift?.start || "",
        clockOut: shift?.end || "",
        breakMinutes: shift?.breakMinutes ?? 60,
        rate: w?.rate || 10,
        notes: "",
        reviewNote: "",
        sourceId: "",
        ...value,
      };
    }
    if (kind === "run")
      return {
        companyId,
        start: month + "-01",
        end:
          month +
          "-" +
          String(
            new Date(
              Number(month.slice(0, 4)),
              Number(month.slice(5, 7)),
              0,
            ).getDate(),
          ).padStart(2, "0"),
      };
    if (kind === "payRun") return { ...value, paymentReference: "" };
    return { ...value };
  }
  const [f, setF] = useState<any>(defaults);
  const update = (key: string, v: any) =>
    setF((old: any) => ({ ...old, [key]: v }));
  const locked = kind === "attendance" && value.id && isLocked(state, value);
  const setCompany = (id: string) =>
    setF({
      ...f,
      companyId: id,
      siteId: "",
      shiftId: "",
      ...(kind === "attendance" ? { workerId: "" } : {}),
    });
  const field = (
    label: string,
    key: string,
    type = "text",
    extra: any = {},
  ) => (
    <Field
      label={label}
      type={type}
      value={f[key] ?? ""}
      required={
        ![
          "phone",
          "bank",
          "account",
          "registration",
          "contact",
          "email",
          "address",
          "notes",
          "reviewNote",
        ].includes(key)
      }
      disabled={locked || busy}
      onInput={(e: any) => {
        if (type === "time" || type === "date")
          update(key, e.currentTarget.value);
      }}
      onChange={(e: any) =>
        update(key, type === "number" ? Number(e.target.value) : e.target.value)
      }
      {...extra}
    />
  );
  const select = (
    label: string,
    key: string,
    options: any[],
    extra: any = {},
  ) => (
    <Field label={label}>
      <select
        value={f[key] ?? ""}
        disabled={locked || busy}
        onChange={(e) => update(key, e.target.value)}
        {...extra}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((o: any) => (
          <option
            key={typeof o === "string" ? o : o.id}
            value={typeof o === "string" ? o : o.id}
          >
            {typeof o === "string" ? o : o.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const companySelect = (
    <Field label="Company">
      <select
        required
        disabled={
          !!locked ||
          busy ||
          (kind === "workers" &&
            value.id &&
            state.attendance.some((a: any) => a.workerId === value.id))
        }
        value={f.companyId || ""}
        onChange={(e) => setCompany(e.target.value)}
      >
        <option value="">Select company</option>
        {state.companies.map((c: any) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.status === "Archived" ? " (archived)" : ""}
          </option>
        ))}
      </select>
    </Field>
  );
  const policyFields = () => (
    <>
      <div className="formGrid">
        {[
          ["Tolerance (minutes)", "grace", 0, 60, 1],
          ["Rounding interval (minutes)", "interval", 1, 120, 1],
          ["Regular hours per day", "dailyRegularHours", 0.5, 24, 0.5],
          ["Overtime multiplier", "otMultiplier", 1, 10, 0.1],
          ["Unusual hours threshold", "maxHours", 1, 24, 0.5],
        ].map(([label, k, min, max, step]) => (
          <Field
            key={String(k)}
            label={label}
            required
            type="number"
            min={min}
            max={max}
            step={step}
            value={f.policy[k as string]}
            onChange={(e: any) =>
              update("policy", {
                ...f.policy,
                [k as string]: Number(e.target.value),
              })
            }
          />
        ))}
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={f.policy.outsideShift}
          onChange={(e) =>
            update("policy", { ...f.policy, outsideShift: e.target.checked })
          }
        />{" "}
        Include time outside scheduled shift
      </label>
      <p className="formHelp">
        Tolerance applies around scheduled shift boundaries. Times outside
        tolerance round to the configured clock intervals. Changes apply to
        newly recorded attendance.
      </p>
    </>
  );
  async function submit(e: any) {
    e.preventDefault();
    let r: any;
    if (
      ["companies", "sites", "shifts", "workers", "attendance"].includes(kind)
    )
      r = await act("saveEntity", { entity: kind, value: f });
    if (kind === "policy")
      r = await act(
        "saveEntity",
        { entity: "companies", value: f },
        "Company attendance policy saved",
      );
    if (kind === "run") {
      r = await act("createRun", f, "Payroll draft prepared");
      if (r) {
        setSelectedRun(r.result.id);
        navigate("Payroll verification");
      }
    }
    if (kind === "adjust")
      r = await act(
        "updateRunRow",
        {
          id: f.runId,
          workerId: f.workerId,
          allowance: f.allowance,
          deduction: f.deduction,
          adjustmentNote: f.adjustmentNote,
        },
        "Payroll adjustments saved",
      );
    if (["finalizeRun", "cancelRun", "refreshRun", "payRun"].includes(kind))
      r = await act(
        kind,
        { id: f.id, paymentReference: f.paymentReference },
        kind === "finalizeRun"
          ? "Payroll finalized"
          : kind === "payRun"
            ? "Payment recorded"
            : "Payroll draft updated",
      );
    if (kind === "clearDemo")
      r = await act("clearDemo", {}, "Sample workspace cleared");
    if (kind === "deleteWorker")
      r = await act(
        "deleteWorker",
        { id: f.id },
        "Worker deleted; history retained",
      );
    if (kind === "removeAttendance")
      r = await act("removeAttendance", { id: f.id }, "Attendance removed");
    if (r) setModal(null);
  }
  const title: any = {
    companies: value.id ? "Edit company" : "Add a company",
    sites: value.id ? "Edit property" : "Add a warehouse or property",
    shifts: value.id ? "Edit shift" : "Create a shift",
    workers: value.id ? "Edit worker" : "Add a temporary worker",
    attendance: locked
      ? "Attendance details (locked)"
      : value.id
        ? "Review attendance"
        : "Record attendance",
    policy: "Attendance policy · " + value.name,
    run: "Prepare a payroll draft",
    adjust: "Adjust payroll · " + value.name,
    finalizeRun: "Finalize this payroll?",
    cancelRun: "Cancel this draft?",
    refreshRun: "Refresh payroll calculations?",
    payRun: "Record a completed payment",
    clearDemo: "Clear the sample workspace?",
    removeAttendance: "Remove this attendance record?",
    deleteWorker: "Delete this worker?",
  };
  let preview: any = null;
  if (kind === "attendance") {
    const sh = state.shifts.find((s: any) => s.id === f.shiftId),
      co = state.companies.find((c: any) => c.id === f.companyId);
    if (co)
      preview = calculate({
        ...f,
        shiftStart:
          value.id && f.shiftId === value.shiftId
            ? value.shiftStart
            : sh?.start || f.shiftStart,
        shiftEnd:
          value.id && f.shiftId === value.shiftId
            ? value.shiftEnd
            : sh?.end || f.shiftEnd,
        policy:
          value.id &&
          f.shiftId === value.shiftId &&
          f.companyId === value.companyId
            ? value.policy
            : co.policy,
      });
  }
  return (
    <Modal
      title={title[kind]}
      description={
        ["companies", "workers", "attendance", "shifts"].includes(kind)
          ? "Keep your workforce records accurate and up to date."
          : undefined
      }
      onClose={() => {
        if (!busy) setModal(null);
      }}
      wide={["attendance", "companies", "workers"].includes(kind)}
    >
      <form className="editorForm" onSubmit={submit}>
        {error && (
          <div className="inlineError" role="alert">
            {error}
          </div>
        )}
        {kind === "companies" && (
          <>
            <div className="formGrid">
              {field("Company name", "name")}
              {field("Registration number", "registration")}
              {field("Contact person", "contact")}
              {field("Contact email", "email", "email")}
            </div>
            {field("Company address", "address")}
            {select("Status", "status", ["Active", "Archived"], {
              required: true,
            })}
            <h3 className="formSectionTitle">
              Default attendance & overtime policy
            </h3>
            {policyFields()}
          </>
        )}
        {kind === "sites" && (
          <>
            {companySelect}
            {field("Property / warehouse name", "name")}
            {select(
              "Property type",
              "type",
              ["Warehouse", "Property", "Office", "Other"],
              { required: true },
            )}
            {field("Address", "address")}
            {select("Status", "status", ["Active", "Archived"], {
              required: true,
            })}
          </>
        )}
        {kind === "shifts" && (
          <>
            {companySelect}
            {select(
              "Property (optional)",
              "siteId",
              state.sites.filter((p: any) => p.companyId === f.companyId),
            )}
            {field("Shift name", "name")}
            <div className="formGrid">
              {field("Shift start", "start", "time")}
              {field("Shift end", "end", "time")}
              {field("Unpaid break (minutes)", "breakMinutes", "number", {
                min: 0,
                max: 720,
              })}
              {select("Status", "status", ["Active", "Archived"], {
                required: true,
              })}
            </div>
            <p className="formHelp">
              An end time earlier than the start indicates an overnight shift.
              Existing attendance retains its recorded shift times.
            </p>
          </>
        )}
        {kind === "workers" && (
          <>
            {companySelect}
            <div className="formGrid">
              {field("Worker ID", "code")}
              {field("Full name", "name")}
              {select(
                "Property (optional)",
                "siteId",
                state.sites.filter((p: any) => p.companyId === f.companyId),
                {
                  onChange: (e: any) => {
                    const shift = state.shifts.find(
                      (s: any) => s.id === f.shiftId,
                    );
                    setF({
                      ...f,
                      siteId: e.target.value,
                      shiftId:
                        shift?.siteId && shift.siteId !== e.target.value
                          ? ""
                          : f.shiftId,
                    });
                  },
                },
              )}
              {select(
                "Assigned shift (optional)",
                "shiftId",
                state.shifts.filter(
                  (s: any) =>
                    s.companyId === f.companyId &&
                    (!f.siteId || !s.siteId || s.siteId === f.siteId),
                ),
              )}
              {field("Hourly rate (RM)", "rate", "number", {
                min: 0.01,
                max: 100000,
                step: 0.01,
              })}
              {field("Phone", "phone", "tel")}
            </div>
            <h3 className="formSectionTitle">Payment details</h3>
            <div className="formGrid">
              {select(
                "Payment method",
                "paymentMethod",
                ["Bank transfer", "Cash"],
                { required: true },
              )}
              {field("Bank name", "bank")}
              {field("Bank account number", "account")}
              {select("Status", "status", ["Active", "Inactive"], {
                required: true,
              })}
            </div>
            <p className="formHelp">
              Changing the hourly rate affects new attendance records. Existing
              attendance and finalized payroll keep their saved rates.
            </p>
          </>
        )}
        {kind === "attendance" && (
          <>
            {companySelect}
            <div className="formGrid">
              {select(
                "Worker",
                "workerId",
                state.workers.filter(
                  (w: any) =>
                    w.companyId === f.companyId &&
                    (!w.deletedAt || w.id === f.workerId),
                ),
                {
                  required: true,
                  onChange: (e: any) => {
                    const w = state.workers.find(
                        (w: any) => w.id === e.target.value,
                      ),
                      sh = state.shifts.find((s: any) => s.id === w?.shiftId);
                    setF({
                      ...f,
                      workerId: e.target.value,
                      rate: w?.rate || 10,
                      siteId: sh?.siteId || w?.siteId || "",
                      shiftId: sh?.id || "",
                      clockIn: sh?.start || "",
                      clockOut: sh?.end || "",
                      breakMinutes: sh?.breakMinutes ?? 60,
                    });
                  },
                },
              )}
              {field("Work date (shift start date)", "date", "date")}
              {select(
                "Shift (optional)",
                "shiftId",
                state.shifts.filter((s: any) => s.companyId === f.companyId),
                {
                  required: false,
                  onChange: (e: any) => {
                    const sh = state.shifts.find(
                      (s: any) => s.id === e.target.value,
                    );
                    setF({
                      ...f,
                      shiftId: e.target.value,
                      siteId: sh?.siteId || f.siteId,
                      breakMinutes: sh?.breakMinutes ?? f.breakMinutes,
                      ...(!value.id
                        ? { clockIn: sh?.start || "", clockOut: sh?.end || "" }
                        : {}),
                    });
                  },
                },
              )}
              {select(
                "Property (optional)",
                "siteId",
                state.sites.filter((p: any) => p.companyId === f.companyId),
              )}
              {!f.shiftId && (
                <>
                  {field("Manual shift start", "shiftStart", "time")}
                  {field("Manual shift end", "shiftEnd", "time")}
                </>
              )}
              {field("Actual clock-in", "clockIn", "time", { required: false })}
              {field("Actual clock-out", "clockOut", "time", {
                required: false,
              })}
              {field("Unpaid break (minutes)", "breakMinutes", "number", {
                min: 0,
                max: 720,
              })}
              {field("Recorded hourly rate (RM)", "rate", "number", {
                min: 0.01,
                max: 1000000,
                step: 0.01,
              })}
            </div>
            {preview && (
              <div className="attendancePreview">
                <div>
                  <small>ADJUSTED CLOCK TIMES</small>
                  <b>
                    {clock(preview.adjustedIn)} → {clock(preview.adjustedOut)}
                  </b>
                </div>
                <div>
                  <small>PAYABLE HOURS</small>
                  <b>{preview.hours.toFixed(2)} h</b>
                </div>
                <div>
                  <small>ESTIMATED WAGES</small>
                  <b>{money(preview.total)}</b>
                </div>
                {preview.errors.length > 0 && (
                  <p>{preview.errors.join(" · ")}</p>
                )}
              </div>
            )}
            {value.original && (
              <div className="originalValues">
                <ShieldCheck size={16} />
                <span>
                  Original entry: {value.original.clockIn || "missing"} →{" "}
                  {value.original.clockOut || "missing"} ·{" "}
                  {value.original.breakMinutes} min break
                </span>
              </div>
            )}
            {field("Attendance notes", "notes")}
            {field(
              "Review note (required to acknowledge unusual hours)",
              "reviewNote",
              "text",
              { required: false },
            )}
            <p className="formHelp">
              Missing punches can be saved for review, but must be corrected
              before payroll finalization. An explanatory review note
              acknowledges unusual working hours.
            </p>
            {f.sourceId && (
              <a
                className="btn secondary"
                href={apiUrl("/api/files?id=" + encodeURIComponent(f.sourceId))}
                download
              >
                <Download size={14} /> Download original source
              </a>
            )}
          </>
        )}
        {kind === "policy" && policyFields}
        {kind === "run" && (
          <>
            {companySelect}
            <div className="formGrid">
              {field("Period start", "start", "date")}
              {field("Period end", "end", "date")}
            </div>
            <div className="note">
              <ClipboardCheck size={19} />
              <p>
                This creates a draft. Review wages, adjust allowances and
                deductions, and fix flagged attendance before finalizing.
              </p>
            </div>
            {f.companyId && (
              <div className="runPreview">
                <span>Attendance-based wages</span>
                <b>
                  {money(
                    buildRows(state, f.companyId, f.start, f.end).reduce(
                      (n: number, w: any) => n + w.net,
                      0,
                    ),
                  )}
                </b>
              </div>
            )}
          </>
        )}
        {kind === "adjust" && (
          <>
            <div className="note">
              <Calculator size={19} />
              <p>
                Base wages: {money(f.regularPay + f.otPay)}. Hours and overtime
                are calculated from saved attendance. Correct attendance and
                refresh the draft to change them.
              </p>
            </div>
            <div className="formGrid">
              {field("Allowance (RM)", "allowance", "number", {
                min: 0,
                max: 1000000,
                step: 0.01,
              })}
              {field("Applicable deductions (RM)", "deduction", "number", {
                min: 0,
                max: 1000000,
                step: 0.01,
              })}
            </div>
            {field("Adjustment explanation", "adjustmentNote", "text", {
              required: !!f.allowance || !!f.deduction,
            })}
            <div className="runPreview">
              <span>Adjusted net pay</span>
              <b>
                {money(
                  f.regularPay +
                    f.otPay +
                    Number(f.allowance) -
                    Number(f.deduction),
                )}
              </b>
            </div>
          </>
        )}
        {kind === "finalizeRun" && (
          <>
            <div className="confirmIcon">
              <ShieldCheck size={30} />
            </div>
            <p className="confirmText">
              You are finalizing <b>{f.companyName}</b> for{" "}
              <b>
                {f.start} — {f.end}
              </b>
              . Payroll amounts will be preserved, and attendance in this period
              will be locked.
            </p>
            <div className="runPreview">
              <span>Total net pay · {f.rows.length} workers</span>
              <b>{money(f.rows.reduce((n: number, w: any) => n + w.net, 0))}</b>
            </div>
          </>
        )}
        {kind === "refreshRun" && (
          <p className="confirmText">
            Recalculate the draft using the latest attendance.{" "}
            <b>
              All allowance and deduction adjustments in this draft will be
              reset.
            </b>{" "}
            Review and enter any adjustments again before finalizing.
          </p>
        )}
        {kind === "cancelRun" && (
          <p className="confirmText">
            This draft will be marked cancelled and retained in the audit trail.
            Attendance will remain available for a new payroll draft.
          </p>
        )}
        {kind === "payRun" && (
          <>
            <div className="note">
              <Wallet size={19} />
              <p>
                Record payment only after you have paid the workers. This action
                updates payroll history and does not send money.
              </p>
            </div>
            <div className="runPreview">
              <span>Total paid</span>
              <b>{money(f.rows.reduce((n: number, w: any) => n + w.net, 0))}</b>
            </div>
            {field("Payment / transaction reference", "paymentReference")}
          </>
        )}
        {kind === "clearDemo" && (
          <p className="confirmText">
            Remove the fictional companies, workers, attendance, and payroll
            runs from this sample workspace. Original uploaded source files
            remain in the document archive.
          </p>
        )}
        {kind === "deleteWorker" && (
          <p className="confirmText">
            Delete <b>{f.name}</b> from the active worker list? Historical
            attendance and payroll are retained. You can restore the worker from
            the Deleted workers filter.
          </p>
        )}
        {kind === "removeAttendance" && (
          <p className="confirmText">
            Remove this unfinalized attendance entry from the register? The
            removal and original times will be recorded in the audit trail.
          </p>
        )}
        <div className="modalActions">
          {kind === "attendance" && value.id && !locked && (
            <Button
              type="button"
              variant="dangerText"
              onClick={() => open("removeAttendance", value)}
            >
              <Trash2 size={14} /> Remove
            </Button>
          )}
          <span />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => setModal(null)}
          >
            {locked ? "Close" : "Cancel"}
          </Button>
          {!locked && (
            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving…"
                : kind === "finalizeRun"
                  ? "Finalize payroll"
                  : kind === "run"
                    ? "Create draft"
                    : kind === "payRun"
                      ? "Confirm payment recorded"
                      : [
                            "clearDemo",
                            "removeAttendance",
                            "deleteWorker",
                            "cancelRun",
                            "refreshRun",
                          ].includes(kind)
                        ? "Confirm"
                        : "Save changes"}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
