"use client";
import { useState } from "react";
export default function Migrate() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main
      style={{
        maxWidth: 650,
        margin: "8vh auto",
        padding: 28,
        background: "white",
        borderRadius: 20,
      }}
    >
      <h1>Import your existing workspace</h1>
      <p>
        Sign in as the superadmin first. On your previous SmartPayroll site,
        open workspace administration and export each workspace as JSON. Import
        each export here.
      </p>
      <p>
        This preserves workers, attendance, payroll, settings and audit entries.
        It refuses to overwrite saved workspaces. Original uploaded documents
        remain on the previous host; keep that site and download those files
        separately.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const f = new FormData(e.currentTarget).get("file") as File;
            const r = await fetch("/api/admin/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: await f.text(),
            });
            const d: any = await r.json();
            if (!r.ok) throw Error(d.error);
            setMessage(d.notice);
          } catch (e: any) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Workspace export JSON
          <input
            type="file"
            name="file"
            accept="application/json,.json"
            required
          />
        </label>
        <button disabled={busy}>
          {busy ? "Importing…" : "Import workspace"}
        </button>
      </form>
      <p role="status">{message}</p>
      <a href="/">Back to SmartPayroll</a>
    </main>
  );
}
