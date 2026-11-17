"use client";
import { useState } from "react";
export default function Login() {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "8vh auto",
        padding: 28,
        background: "white",
        borderRadius: 20,
      }}
    >
      <h1>SmartPayroll</h1>
      <h2>{register ? "Create account" : "Sign in"}</h2>
      <p>
        Accounts on this address are separate from the previous host. Existing
        records require import.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: register ? "register" : "login",
                email: f.get("email"),
                password: f.get("password"),
                setupKey: f.get("setupKey"),
              }),
            });
            const d: any = await r.json();
            if (!r.ok) throw Error(d.error);
            location.assign("/");
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email
          <input
            style={{ display: "block", width: "100%", marginBottom: 18 }}
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password (12–128 characters)
          <input
            style={{ display: "block", width: "100%", marginBottom: 18 }}
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <label>
            Owner setup key (owner account only)
            <input
              style={{ display: "block", width: "100%", marginBottom: 18 }}
              name="setupKey"
              type="password"
              autoComplete="off"
            />
            <small>
              Set SMARTPAYROLL_ADMIN_SETUP_KEY in your Netlify project first.
              Other accounts leave this empty.
            </small>
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <button disabled={busy} type="submit">
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register ? "Already registered? Sign in" : "Create an account"}
      </button>
      <p>
        <a href="/">Continue with this browser’s guest workspace</a>
      </p>
    </main>
  );
}
