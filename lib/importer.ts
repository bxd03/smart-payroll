import type { Workspace } from "./model";
export type ImportRow = {
  workerCode: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  issues: string[];
};
export function normalDate(v: any): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
}
export function normalTime(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(11, 16);
  if (typeof v === "number" && v >= 0 && v < 1) {
    const n = Math.round(v * 1440) % 1440;
    return (
      String(Math.floor(n / 60)).padStart(2, "0") +
      ":" +
      String(n % 60).padStart(2, "0")
    );
  }
  const s = String(v).trim(),
    m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return s;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
  return String(h).padStart(2, "0") + ":" + m[2];
}
export function tableRows(raw: any[][], breakMinutes: number): ImportRow[] {
  if (!raw.length) return [];
  const normalize = (v: any) =>
    String(v ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const keys = raw[0].map(normalize);
  const index = (names: string[], fallback: number) => {
    const i = keys.findIndex((k) => names.includes(k));
    return i >= 0 ? i : fallback;
  };
  const hasHeader = keys.some((k) =>
    [
      "workerid",
      "workercode",
      "employeeid",
      "date",
      "workdate",
      "clockin",
    ].includes(k),
  );
  const cols = {
    w: index(["workerid", "workercode", "employeeid", "id"], 0),
    d: index(["date", "workdate", "attendancedate"], 1),
    i: index(["clockin", "timein", "in", "actualclockin"], 2),
    o: index(["clockout", "timeout", "out", "actualclockout"], 3),
    b: index(["break", "breakminutes", "unpaidbreak"], 4),
  };
  return raw
    .slice(hasHeader ? 1 : 0)
    .filter((r) => r.some((x) => x !== "" && x !== null && x !== undefined))
    .map((r) => ({
      workerCode: String(r[cols.w] ?? "").trim(),
      date: normalDate(r[cols.d]),
      clockIn: normalTime(r[cols.i]),
      clockOut: normalTime(r[cols.o]),
      breakMinutes:
        r[cols.b] !== undefined && r[cols.b] !== ""
          ? Number(r[cols.b])
          : breakMinutes,
      issues: [],
    }));
}
export function textRows(text: string, breakMinutes: number): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/);
    if (!m || m.index === undefined) continue;
    const code =
      line
        .slice(0, m.index)
        .trim()
        .split(/[\s,;|]+/)[0] || "";
    const times =
      line
        .slice(m.index + m[0].length)
        .match(/\d{1,2}[:.]\d{2}(?::\d{2})?\s*(?:AM|PM)?/gi) || [];
    rows.push({
      workerCode: code,
      date: normalDate(m[0]),
      clockIn: normalTime(times[0]),
      clockOut: normalTime(times[1]),
      breakMinutes,
      issues: [],
    });
  }
  return rows;
}
export function validateImport(
  rows: ImportRow[],
  s: Workspace,
  companyId: string,
) {
  const seen = new Set<string>();
  return rows.map((r) => {
    const issues: string[] = [];
    const w = s.workers.find(
      (w) =>
        w.companyId === companyId &&
        w.code.toLowerCase() === r.workerCode.toLowerCase(),
    );
    if (!w) issues.push("Unknown worker ID");
    else if (w.deletedAt)
      issues.push("Worker is deleted; restore before importing");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      Number.isNaN(Date.parse(r.date + "T12:00:00"))
    )
      issues.push("Invalid date");
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.clockIn) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.clockOut)
    )
      issues.push("Missing / invalid time");
    if (
      !Number.isInteger(r.breakMinutes) ||
      r.breakMinutes < 0 ||
      r.breakMinutes > 720
    )
      issues.push("Invalid break");
    const key = r.workerCode.toLowerCase() + r.date;
    if (
      seen.has(key) ||
      s.attendance.some((a) => a.workerId === w?.id && a.date === r.date)
    )
      issues.push("Duplicate attendance");
    seen.add(key);
    if (
      s.runs.some(
        (p) =>
          p.companyId === companyId &&
          p.status !== "Draft" &&
          p.status !== "Cancelled" &&
          p.start <= r.date &&
          p.end >= r.date,
      )
    )
      issues.push("Finalized payroll period");
    return { ...r, issues };
  });
}
export async function extractFile(
  file: File,
  breakMinutes: number,
  progress: (s: string) => void,
) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (["xlsx", "xls", "csv"].includes(ext || "")) {
    progress("Reading spreadsheet…");
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: true,
    });
    const rows = tableRows(
      XLSX.utils.sheet_to_json<any[]>(book.Sheets[book.SheetNames[0]], {
        header: 1,
        defval: "",
      }),
      breakMinutes,
    );
    return { rows, text: "", method: "Spreadsheet" };
  }
  if (ext === "pdf") {
    progress("Reading PDF…");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
      .promise;
    if (pdf.numPages > 20)
      throw Error("Import PDF documents of up to 20 pages at a time.");
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p),
        content = await page.getTextContent();
      let line = "",
        lastY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (lastY !== undefined && Math.abs(y - lastY) > 4) {
          text += line + "\n";
          line = "";
        }
        line += item.str + " ";
        lastY = y;
      }
      text += line + "\n";
    }
    if (text.trim().length > 20)
      return { rows: textRows(text, breakMinutes), text, method: "PDF text" };
    let scanned = "";
    for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
      progress(`Scanning PDF page ${p}/${Math.min(pdf.numPages, 5)}…`);
      const page = await pdf.getPage(p),
        viewport = page.getViewport({ scale: 1.8 }),
        canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
      }).promise;
      scanned +=
        (await recognize(canvas.toDataURL("image/png"), progress)) + "\n";
      canvas.width = 0;
      canvas.height = 0;
    }
    return {
      rows: textRows(scanned, breakMinutes),
      text: scanned,
      method: `Scanned PDF (${Math.min(pdf.numPages, 5)} pages${pdf.numPages > 5 ? " — first 5 only" : ""})`,
    };
  }
  if (file.type.startsWith("image/")) {
    progress("Starting document scanner…");
    const text = await recognize(file, progress);
    return { rows: textRows(text, breakMinutes), text, method: "Image OCR" };
  }
  throw Error("Choose Excel, CSV, PDF, PNG, JPG or WebP");
}
async function recognize(input: File | string, progress: (s: string) => void) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/tesseract-core-lstm.wasm.js",
    langPath: "/ocr",
    logger: (m: any) => {
      if (m.status === "recognizing text")
        progress("Reading document… " + Math.round(m.progress * 100) + "%");
    },
  });
  try {
    const result = await worker.recognize(input);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
