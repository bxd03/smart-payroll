"use client";
import { useState, useEffect } from "react";
import Settings from "../../components/payroll/settings";
import { type Profile } from "../../components/payroll/profile";
import { translate } from "../../lib/dashboard-language";
export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) return;
        if (!r.ok) throw Error("Unable to load settings. Please reload.");
        setProfile((await r.json()) as Profile);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.lang = profile?.language || "en";
  }, [profile]);
  const t = (s: string) => translate(profile?.language || "en", s);
  return (
    <main className="settingsStandalone">
      <a className="settingsBack" href="/">
        ← {t("Payroll dashboard")}
      </a>
      <h1>{t("Account settings")}</h1>
      {loading ? (
        <p role="status">Loading settings…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <Settings profile={profile} onSave={setProfile} t={t} />
      )}
    </main>
  );
}
