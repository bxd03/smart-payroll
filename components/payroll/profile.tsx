"use client";
import { useEffect, useState } from "react";

export type Profile = {
  email: string;
  displayName: string;
  avatar: string;
  language: "en" | "ms";
};
export function Avatar({ profile }: { profile: Profile | null }) {
  const name = profile?.displayName || profile?.email || "SP";
  return profile?.avatar ? (
    <img className="accountAvatar" src={profile.avatar} alt="" />
  ) : (
    <span className="accountAvatar">{name.slice(0, 2).toUpperCase()}</span>
  );
}
export function ProfileSettings({
  profile,
  onSave,
  t,
  section = "profile",
}: {
  section?: "profile" | "language";
  profile: Profile | null;
  onSave: (p: Profile) => void;
  t: (s: string) => string;
}) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(profile);
  }, [profile]);
  async function choosePhoto(file?: File) {
    if (!file || !draft) return;
    setError("");
    setMessage("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(t("Choose a JPG, PNG or WebP image under 5 MB."));
      return;
    }
    setProcessing(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw Error();
      const side = Math.min(image.width, image.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 256, 256);
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      setDraft(
        (current) =>
          current && {
            ...current,
            avatar: canvas.toDataURL("image/jpeg", 0.85),
          },
      );
    } catch {
      setError(t("Unable to read this image. Choose another photo."));
    } finally {
      URL.revokeObjectURL(url);
      setProcessing(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          displayName: draft?.displayName || draft?.email.split("@")[0],
        }),
      });
      const result = (await response.json()) as Profile & { error?: string };
      if (!response.ok) throw Error(result.error);
      onSave(result);
      setMessage(
        result.language === "ms" ? "Profil disimpan." : "Profile saved.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("Unable to save. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }
  if (!draft)
    return (
      <section className="profileSettings">
        <p>{t("Sign in to customise your profile across devices.")}</p>
        <a className="btn primary" href="/login">
          {t("Sign in")}
        </a>
      </section>
    );
  return (
    <div>
      <form className="profileSettings" onSubmit={save}>
        <div className="profilePhotoRow">
          <Avatar profile={draft} />
          <div>
            <h2>
              {t(
                section === "language"
                  ? "Language preferences"
                  : "Your profile",
              )}
            </h2>
            <p>{draft.email}</p>
          </div>
        </div>
        <fieldset disabled={busy || processing}>
          {section === "profile" && (
            <>
              <label className="profileField">
                {t("Profile picture")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    void choosePhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="profileHint">
                {t(
                  "JPG, PNG or WebP, up to 5 MB. Photos are cropped to a square.",
                )}
              </p>
              {draft.avatar && (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setDraft({ ...draft, avatar: "" })}
                >
                  {t("Remove photo")}
                </button>
              )}
              <label className="profileField">
                {t("Display name")}
                <input
                  required
                  maxLength={80}
                  autoComplete="nickname"
                  value={draft.displayName}
                  onChange={(e) =>
                    setDraft({ ...draft, displayName: e.target.value })
                  }
                />
              </label>
            </>
          )}
          {section === "language" && (
            <>
              <label className="profileField">
                {t("Dashboard language")}
                <select
                  value={draft.language}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      language: e.target.value as Profile["language"],
                    })
                  }
                >
                  <option value="en">English</option>
                  <option value="ms">Bahasa Melayu</option>
                </select>
              </label>
              <p className="profileHint">
                {t(
                  "Applies to dashboard and navigation. Detailed payroll forms and exports use English.",
                )}
              </p>
            </>
          )}
          <button className="btn primary" type="submit">
            {t(
              busy
                ? "Saving…"
                : processing
                  ? "Processing photo…"
                  : "Save profile",
            )}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="errorBanner">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </form>
    </div>
  );
}
