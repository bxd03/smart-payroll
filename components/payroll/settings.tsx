"use client";
import { useEffect, useState } from "react";
import {
  UserRound,
  ShieldCheck,
  Languages,
  Monitor,
  ChevronRight,
  LockKeyhole,
  ArrowLeft,
} from "lucide-react";
import { Avatar, ProfileSettings, type Profile } from "./profile";
import PasswordSettings from "./password";
export default function Settings({
  profile,
  onSave,
  t,
}: {
  profile: Profile | null;
  onSave: (p: Profile) => void;
  t: (s: string) => string;
}) {
  const [section, setSection] = useState("overview");
  const tr = (en: string, ms: string) => (profile?.language === "ms" ? ms : en);
  const items = [
    {
      id: "profile",
      icon: UserRound,
      title: tr("Profile information", "Maklumat profil"),
      detail: tr(
        "Manage your name and profile photo.",
        "Urus nama dan gambar profil.",
      ),
    },
    {
      id: "password",
      icon: LockKeyhole,
      title: tr("Password & security", "Kata laluan & keselamatan"),
      detail: tr(
        "Change your password with identity verification.",
        "Tukar kata laluan dengan pengesahan identiti.",
      ),
    },
    {
      id: "sessions",
      icon: Monitor,
      title: tr("Signed-in sessions", "Sesi log masuk"),
      detail: tr(
        "Review active sessions and sign out elsewhere.",
        "Semak sesi aktif dan log keluar sesi lain.",
      ),
    },
    {
      id: "language",
      icon: Languages,
      title: tr("Language preferences", "Pilihan bahasa"),
      detail: tr(
        "Choose your dashboard language.",
        "Pilih bahasa papan pemuka.",
      ),
    },
  ];
  if (!profile)
    return (
      <section className="businessSettings">
        <div className="settingsIntro">
          <ShieldCheck />
          <h2>{tr("Your account settings", "Tetapan akaun anda")}</h2>
          <p>Sign in to manage your profile and security settings.</p>
          <a className="btn primary" href="/login">
            Sign in
          </a>
        </div>
      </section>
    );
  return (
    <section className="businessSettings">
      <div className="settingsIdentity">
        <Avatar profile={profile} />
        <div>
          <strong>{profile.displayName || profile.email.split("@")[0]}</strong>
          <span>{profile.email}</span>
        </div>
        <span className="settingsAccountTag">
          {tr("Personal account", "Akaun peribadi")}
        </span>
      </div>
      <div className="settingsLayout">
        <nav
          aria-label={tr(
            "Account settings categories",
            "Kategori tetapan akaun",
          )}
          className="settingsNav"
        >
          <button
            className={section === "overview" ? "selected" : ""}
            onClick={() => setSection("overview")}
          >
            <ShieldCheck size={18} />
            {tr("Settings overview", "Ringkasan tetapan")}
          </button>
          {items.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "selected" : ""}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <item.icon size={18} />
              {item.title}
            </button>
          ))}
        </nav>
        <div className="settingsPanel" key={section}>
          {section === "overview" ? (
            <>
              <div className="settingsIntro">
                <span className="settingsEyebrow">SMARTPAYROLL</span>
                <h2>{tr("Account settings", "Tetapan akaun")}</h2>
                <p>
                  {tr(
                    "Manage your personal details, preferences and access to your account.",
                    "Urus maklumat peribadi, pilihan dan akses akaun anda.",
                  )}
                </p>
              </div>
              <div className="settingsRows">
                {items.map((item) => (
                  <button key={item.id} onClick={() => setSection(item.id)}>
                    <span className="settingsIcon">
                      <item.icon size={21} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
              <div className="settingsNotice">
                <ShieldCheck size={19} />
                <p>
                  {tr(
                    "Security actions require your current password. Your settings apply to your own account, including when you manage another workspace.",
                    "Tindakan keselamatan memerlukan kata laluan semasa. Tetapan ini digunakan pada akaun anda walaupun anda mengurus ruang kerja lain.",
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <button
                className="settingsBack"
                onClick={() => setSection("overview")}
              >
                <ArrowLeft size={16} />
                {tr("All settings", "Semua tetapan")}
              </button>
              {section === "profile" || section === "language" ? (
                <ProfileSettings
                  section={section}
                  profile={profile}
                  onSave={onSave}
                  t={t}
                />
              ) : section === "password" ? (
                <PasswordSettings language={profile.language} />
              ) : (
                <Sessions language={profile.language} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
function Sessions({ language }: { language: string }) {
  const [sessions, setSessions] = useState<
      { expires_at: string; current: boolean }[]
    >([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const t = (en: string, ms: string) => (language === "ms" ? ms : en);
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/account/sessions", { cache: "no-store" });
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      setSessions(d.sessions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function end(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/account/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      setPassword("");
      setConfirm(false);
      setMessage(
        t(
          "All other sessions have been signed out.",
          "Semua sesi lain telah dilog keluar.",
        ),
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sessionSettings">
      <h2>{t("Signed-in sessions", "Sesi log masuk")}</h2>
      <p className="profileHint">
        {t(
          "These are active account sessions. Device names and locations are not collected.",
          "Ini ialah sesi akaun aktif. Nama peranti dan lokasi tidak dikumpulkan.",
        )}
      </p>
      {loading ? (
        <p role="status">{t("Loading sessions…", "Memuatkan sesi…")}</p>
      ) : (
        <ul className="sessionList">
          {sessions.map((s, i) => (
            <li key={i}>
              <Monitor size={21} />
              <div>
                <strong>
                  {s.current
                    ? t("This session", "Sesi ini")
                    : t("Other session", "Sesi lain") + " " + (i + 1)}
                </strong>
                <small>
                  {t("Expires", "Tamat")}{" "}
                  {new Date(s.expires_at).toLocaleString(
                    language === "ms" ? "ms-MY" : "en-MY",
                    { timeZone: "Asia/Kuala_Lumpur" },
                  )}{" "}
                  MYT
                </small>
              </div>
              {s.current && (
                <span className="sessionCurrent">{t("Current", "Semasa")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions.some((s) => !s.current) && !confirm && (
        <button
          className="btn secondary"
          onClick={() => {
            setConfirm(true);
            setMessage("");
          }}
        >
          {t("Sign out all other sessions", "Log keluar semua sesi lain")}
        </button>
      )}
      {confirm && (
        <form className="sessionConfirm" onSubmit={end}>
          <h3>{t("Confirm it is you", "Sahkan identiti anda")}</h3>
          <p>
            {t(
              "Your current session stays signed in. All other sessions must sign in again.",
              "Sesi ini kekal aktif. Semua sesi lain perlu log masuk semula.",
            )}
          </p>
          <label className="profileField">
            {t("Current password", "Kata laluan semasa")}
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="settingsActions">
            <button className="btn primary" disabled={busy}>
              {t("Confirm sign out", "Sahkan log keluar")}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                setPassword("");
              }}
            >
              {t("Cancel", "Batal")}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="errorBanner">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="settingsSuccess">
          {message}
        </p>
      )}
    </div>
  );
}
