"use client";
import { useState } from "react";
export default function PasswordSettings({ language }: { language: string }) {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const t = (en: string, ms: string) => (language === "ms" ? ms : en);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirm) {
      setError(
        t("New passwords do not match.", "Kata laluan baharu tidak sepadan."),
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "password",
          currentPassword: current,
          password,
        }),
      });
      const result = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(result.error);
      setCurrent("");
      setPassword("");
      setConfirm("");
      setMessage(
        t(
          "Password updated. Other signed-in sessions have ended.",
          "Kata laluan dikemas kini. Sesi log masuk lain telah ditamatkan.",
        ),
      );
    } catch (e: any) {
      setError(
        e.message ||
          t(
            "Unable to update password.",
            "Tidak dapat mengemas kini kata laluan.",
          ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="profileSettings passwordSettings" onSubmit={save}>
      <h2>{t("Password & security", "Kata laluan & keselamatan")}</h2>
      <p className="profileHint">
        {t(
          "Enter your current password to choose a new one. Other signed-in sessions will end.",
          "Masukkan kata laluan semasa untuk memilih yang baharu. Sesi log masuk lain akan ditamatkan.",
        )}
      </p>
      <fieldset disabled={busy}>
        <label className="profileField">
          {t("Current password", "Kata laluan semasa")}
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={128}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="profileField">
          {t("New password", "Kata laluan baharu")}
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p className="profileHint">
          {t("Use 12–128 characters.", "Gunakan 12–128 aksara.")}
        </p>
        <label className="profileField">
          {t("Confirm new password", "Sahkan kata laluan baharu")}
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <label className="passwordVisibility">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />{" "}
          {t("Show passwords", "Tunjukkan kata laluan")}
        </label>
        <button className="btn primary" disabled={busy}>
          {busy
            ? t("Saving…", "Menyimpan…")
            : t("Update password", "Kemas kini kata laluan")}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="errorBanner">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
