# SmartPayroll

A complete temporary-worker payroll web app based on the 11 SmartPayroll modules in the supplied proposal. The standalone application lives at the root of https://github.com/bxd03/smart-payroll.

Live: https://smartpayroll.greyapex8.chatgpt.site

## Modules

| Proposal module             | Implementation                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company Management          | Companies, warehouses/properties, contacts, addresses, archive status, company policies                                                           |
| Temporary Worker Management | Worker IDs, company/property/shift assignments, hourly rates, phone and payment details                                                           |
| Attendance Scanner          | Excel/XLS/CSV import, PDF text extraction, image OCR, scanned PDF OCR, editable staging table, validation, original document archive              |
| Shift Management            | Company shifts, property assignments, shift start/end, unpaid breaks, overnight shifts                                                            |
| Attendance Configuration    | Company tolerance, rounding intervals, regular-hour thresholds, overtime multiplier, anomaly threshold, outside-shift policy                      |
| Working Hours Calculator    | Interactive preview, actual/rounded times, payable hours, regular/OT hours and earnings                                                           |
| Payroll Calculator          | Server-calculated regular wages and overtime, manual allowances and applicable deductions with reasons                                            |
| Error Detection             | Missing/invalid punches, identical times, excessive breaks, zero payable hours, unusual duration, duplicate prevention and expected-worker checks |
| Payroll Verification        | Draft review, adjustment notes, stale-draft detection, refresh, finalization, locked attendance, audit trail                                      |
| Report & Export             | Actual XLSX workbooks and downloadable PDF payslips                                                                                               |
| Payroll History             | Immutable company/worker/period snapshots, finalized/paid states and payment reference                                                            |

Names omit “AI” as requested. Recognition uses Tesseract OCR; anomaly detection is deterministic. No generated or simulated model responses are represented as AI.

## Stack

React 19 + TypeScript, Vinext/Vite, Cloudflare Workers, D1, R2, Zod, SheetJS, PDF.js, Tesseract.js, jsPDF. The site is public. Each anonymous browser has a separate workspace selected by an opaque HttpOnly cookie. Signed-in visitors receive a separate account workspace. Source files, banking details and payroll records are not public.

## Run locally

Requires Node.js 22.13+ and npm. From this app directory:

```sh
npm ci
npm run build
```

Apply each local migration once, in order (a fresh local database needs both):

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tidy_steel_serpent.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_oval_adam_warlock.sql
npm run dev
```

Managed preview uses `sites-preview start <checkout>` instead. `.openai/hosting.json` declares D1 `DB` and R2 `BUCKET`. The `prebuild` and `predev` scripts copy OCR/PDF worker and English recognition assets from locked npm packages into ignored public assets. Recognition is self-hosted and does not require API keys.

## Workflow

1. Create a company and verify its attendance/OT rules.
2. Add properties, shifts, and workers with hourly rates and payment details.
3. Import an attendance document or enter records manually.
4. Review extracted rows and correct unknown IDs, missing times, or duplicates.
5. Resolve attendance issues. Unusual duration can be acknowledged with an explanatory note; missing punches must be corrected.
6. Create a company payroll draft for a date range.
7. Enter allowances/deductions and explanations per worker. If attendance changes, refresh the draft and review adjustments again (refresh resets them).
8. Finalize payroll to preserve snapshots and lock attendance in that company's period.
9. Download Excel and PDF payslips, pay through your normal process, and record the completed payment reference.

## Calculation policy

The original proposal examples are covered by tests: 07:33/07:35 -> 07:30; 07:36/07:45 -> 08:00; 19:20 -> 19:00; 19:25/19:27 -> 19:30 for a 07:30–19:30 shift with 5-minute tolerance and 30-minute intervals.

- Outside tolerance, clock-in rounds upward and clock-out downward to wall-clock intervals.
- Scheduled bounds apply unless the company explicitly includes outside-shift time.
- Unpaid break minutes are deducted after rounding.
- Payable hours split into regular hours and daily overtime using the recorded company threshold; OT pays the saved rate times the recorded multiplier.
- Wages are rounded to two decimal places per shift component; payroll sums these values.
- Each attendance stores original times and a snapshot of shift bounds, company policy and hourly rate. Editing master records does not rewrite history.
- Applicable deductions are explicitly entered and verified by staff. EPF, SOCSO, EIS and tax rates are not automatically inferred. The software does not transfer money or make legal entitlement decisions.

## Persistence, authorization and audit

D1 stores the versioned workspace document plus normalized source metadata and audit events; R2 stores source files. `smartpayroll-v2` is a separate state key so the previous prototype is not overwritten. API operations validate entity relationships and financial inputs server-side; finalized attendance and payroll cannot be edited. Optimistic revisions reject competing stale writes. Updates and their audit insert are in one D1 batch. On a conflict, reload and reapply the intended change. All payroll, document and audit queries are scoped server-side to the current workspace. The original owner keeps the existing workspace via the runtime SMARTPAYROLL_OWNER_EMAIL secret; no owner email is checked into source. Guests cannot select an account or legacy owner key through cookies. Guest records depend on keeping the browser cookie. Signing in opens a separate account workspace; guest data is not automatically transferred.

## Import constraints

- 15 MB source upload maximum; 500 validated rows per import transaction; first worksheet only.
- Text PDFs: up to 20 pages. Image-only PDFs: first 5 pages, explicitly labelled.
- OCR recognizes English/Latin text. Use clear, upright scans. Worker ID and work date must be checked by a person.
- Automatic text row mapping works best as `TW-001 2026-11-17 07:33 19:27`. For nonstandard punch cards, edit recognized text or fill the review table. Scanning does not guarantee layout interpretation.
- Import invalid/duplicate rows are blocked in the staging table; the server also rejects duplicates and locked periods atomically before saving the workspace.
- File metadata shows total committed attendance rows. Source files are retained even if scanning or row validation needs another attempt.
- Informational “workers without a record” checks are not proof of absence; the operator confirms whether a worker was expected that day.
- Current workspace JSON is capped at 4 MB; this app is intended for an agency-scale pilot. Before substantially scaling, migrate entity collections to individually indexed relational tables and add pagination.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
```

Tests cover tolerance boundaries, overtime and monetary precision, overnight shifts, invalid dates, cross-company relationships, duplicates, immutable originals and policies, stale drafts, deductions, finalization locks and payment references, plus spreadsheet/text row mapping.

## Repository and deployment

This folder contains application source, locked dependencies, schema migrations, tests, and asset preparation. No production data, uploaded documents, runtime secrets, local database files, or build outputs belong in Git. The Site's deployment source repository is managed separately by the hosting service; GitHub holds this standalone source copy. GitHub commits do not automatically publish to the Site. Publish through the Sites source/build/deploy workflow to apply schema migrations and R2/D1 bindings.

## Phone installation (PWA)

Open the HTTPS live URL on a phone. Android Chrome: use Install app when offered, or the browser menu > Install app / Add to Home screen. iPhone Safari: Share > Add to Home Screen > Add. A manifest, standalone display mode, 192/512 px icons, maskable icon and Apple touch icon are included. The service worker caches only the offline page, manifest and app icons. Payroll APIs, uploaded documents, authentication responses and app HTML are never cached by the service worker. Internet is required for payroll operations.

The new additive migration `drizzle/0002_wooden_the_twelve.sql` scopes source files and audit events to workspaces; apply it after the earlier migrations for local development. Production migrations apply through Sites.

## Superadmin and direct attendance editing

The site owner signs in using the original ChatGPT account. Its verified email must match the private `SMARTPAYROLL_OWNER_EMAIL` runtime value; this enables superadmin server-side. Superadmin can list all persisted account, guest and legacy workspaces, open current workspaces, review documents and history, make normal edits, and export raw data with all audit events. Ordinary users cannot choose another workspace through query parameters. No superadmin email or credentials are stored in the public repository.

Temporary workers now have inline shift selection, work date, punch-in/out inputs, break input, and Save times. A shift is optional when a complete manual interval is supplied. Worker Edit/Delete buttons are explicit. Deletion is soft: deleted workers can be restored and historical attendance/payroll stay intact. Attendance records have inline editable clock times and Save clock times. Finalized payroll remains locked, and original attendance times are retained.

Database: Cloudflare D1 stores workspace records, source-file metadata and audit events. R2 stores the actual uploaded source files. Browser cookies identify a guest workspace; payroll data is stored on the server.
