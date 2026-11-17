import { money, type Run, type Workspace } from "./model";
import { calculate, clock } from "./engine";
export async function exportWorkbook(
  s: Workspace,
  companyId: string,
  month: string,
  run?: Run,
) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  if (run) {
    const rows = run.rows.map((w) => ({
      "Worker ID": w.code,
      Name: w.name,
      Company: run.companyName,
      "Period start": run.start,
      "Period end": run.end,
      Status: run.status,
      Shifts: w.days,
      "Regular hours": w.regularHours,
      "Overtime hours": w.otHours,
      "Regular pay (RM)": w.regularPay,
      "Overtime pay (RM)": w.otPay,
      "Allowances (RM)": w.allowance,
      "Deductions (RM)": w.deduction,
      "Gross pay (RM)": w.gross,
      "Net pay (RM)": w.net,
      "Payment method": w.paymentMethod,
      Bank: w.bank,
      "Account number": w.account,
      "Adjustment note": w.adjustmentNote,
    }));
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(rows),
      "Payroll",
    );
  }
  const attendance = s.attendance
    .filter((a) =>
      run
        ? a.companyId === run.companyId &&
          a.date >= run.start &&
          a.date <= run.end
        : (!companyId || a.companyId === companyId) && a.date.startsWith(month),
    )
    .map((a) => {
      const w = s.workers.find((w) => w.id === a.workerId),
        c = calculate(a);
      return {
        "Worker ID": w?.code,
        Name: w?.name,
        Company: s.companies.find((x) => x.id === a.companyId)?.name,
        Date: a.date,
        "Actual in": a.clockIn,
        "Actual out": a.clockOut,
        "Original in": a.original.clockIn,
        "Original out": a.original.clockOut,
        "Adjusted in": clock(c.adjustedIn),
        "Adjusted out": clock(c.adjustedOut),
        "Break minutes": a.breakMinutes,
        "Hourly rate": a.rate,
        "Payable hours": c.hours,
        "Regular hours": c.regularHours,
        "OT hours": c.otHours,
        "Regular pay": c.regularPay,
        "OT pay": c.otPay,
        "Total (RM)": c.total,
        "Review note": a.reviewNote,
        "Source file ID": a.sourceId,
      };
    });
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(attendance),
    "Attendance",
  );
  for (const sheet of book.SheetNames) {
    book.Sheets[sheet]["!cols"] = Array.from({ length: 25 }, () => ({
      wch: 21,
    }));
  }
  XLSX.writeFile(book, `SmartPayroll-${run ? run.start : month}.xlsx`);
}
export async function exportPayslip(run: Run, workerId: string) {
  const row = run.rows.find((w) => w.workerId === workerId)!;
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const pdf = new jsPDF();
  pdf.setFillColor(24, 66, 53);
  pdf.rect(0, 0, 210, 45, "F");
  pdf.setTextColor(255);
  pdf.setFontSize(23);
  pdf.text("SmartPayroll", 16, 23);
  pdf.setFontSize(10);
  pdf.text("PAYSLIP  /  " + run.status.toUpperCase(), 16, 34);
  pdf.setTextColor(28, 50, 44);
  pdf.setFontSize(16);
  pdf.text(run.companyName, 16, 61);
  pdf.setFontSize(10);
  pdf.text(pdf.splitTextToSize(run.companyAddress || "", 175), 16, 69);
  pdf.text(`Worker: ${row.name} (${row.code})`, 16, 88);
  pdf.text(`Period: ${run.start} to ${run.end}`, 16, 96);
  pdf.text(
    `Payment: ${row.paymentMethod} | ${row.bank} | ${row.account}`,
    16,
    104,
  );
  autoTable(pdf, {
    startY: 116,
    head: [["Earnings & deductions", "Quantity", "Amount (RM)"]],
    body: [
      ["Regular hours", row.regularHours.toFixed(2), row.regularPay.toFixed(2)],
      ["Overtime hours", row.otHours.toFixed(2), row.otPay.toFixed(2)],
      ["Allowances", "", row.allowance.toFixed(2)],
      ["Gross earnings", "", row.gross.toFixed(2)],
      ["Deductions", "", row.deduction.toFixed(2)],
      ["NET PAY", "", row.net.toFixed(2)],
    ],
    headStyles: { fillColor: [39, 108, 83] },
    styles: { fontSize: 10, cellPadding: 5 },
  });
  let y = (pdf as any).lastAutoTable.finalY + 15;
  pdf.setFontSize(9);
  const notes = [
    `Shifts: ${row.days}`,
    `Adjustment note: ${row.adjustmentNote || "None"}`,
    `Finalized by: ${run.finalizedBy || "Not finalized"}`,
    `Payment reference: ${run.paymentReference || "Not yet paid"}`,
  ];
  for (const note of notes) {
    const lines = pdf.splitTextToSize(note, 175);
    if (y + lines.length * 5 > 275) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(lines, 16, y);
    y += lines.length * 5 + 3;
  }
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  if (y > 260) {
    pdf.addPage();
    y = 20;
  }
  pdf.text(
    "Deductions are entered and verified by authorized payroll staff. No statutory rates are assumed.",
    16,
    y + 7,
  );
  pdf.save(`Payslip-${row.code}-${run.start}.pdf`);
}
export async function importTemplate() {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Worker ID", "Date", "Clock In", "Clock Out", "Break Minutes"],
    ["TW-001", "2026-11-17", "07:33", "19:27", 60],
  ]);
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(book, sheet, "Attendance");
  XLSX.writeFile(book, "SmartPayroll-attendance-template.xlsx");
}
