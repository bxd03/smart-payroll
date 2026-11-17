"use client";
import { useState } from "react";
import {
  Wallet,
  ShieldCheck,
  Clock3,
  Users,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
export default function Login() {
  const [register, setRegister] = useState(false),
    [owner, setOwner] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [showKey, setShowKey] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function mode(value: boolean) {
    setRegister(value);
    setError("");
    setOwner(false);
    setShowKey(false);
  }
  return (
    <main className="authPage">
      <div className="authShell">
        <div className="authBrandPanel">
          <a className="authLogo" href="/" aria-label="SmartPayroll home">
            <span>
              <Wallet size={23} />
            </span>
            SmartPayroll<span className="authLogoDot">.</span>
          </a>
          <div className="authBrandContent">
            <span className="authEyebrow">YOUR PAYROLL WORKSPACE</span>
            <h1>
              Every hour.
              <br />
              Every worker.
              <br />
              <em>All accounted for.</em>
            </h1>
            <p>
              A clear view of attendance, working hours, and payroll—together in
              one organised workspace.
            </p>
            <div className="authBenefits">
              <div>
                <Clock3 size={19} />
                <span>Attendance and working hours</span>
              </div>
              <div>
                <Users size={19} />
                <span>Your temporary workforce</span>
              </div>
              <div>
                <ShieldCheck size={19} />
                <span>Separate account workspaces</span>
              </div>
            </div>
          </div>
          <small className="authBrandFooter">
            SmartPayroll · Temporary workforce management
          </small>
        </div>
        <div className="authFormPanel">
          <div className="authTabs" role="group" aria-label="Account access">
            <button
              type="button"
              aria-pressed={!register}
              className={!register ? "selected" : ""}
              onClick={() => mode(false)}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={register}
              className={register ? "selected" : ""}
              onClick={() => mode(true)}
            >
              Create account
            </button>
          </div>
          <div className="authHeading">
            <h2>{register ? "Create your account" : "Welcome back"}</h2>
            <p>
              {register
                ? "Set up your workspace to get started."
                : "Sign in to manage your workforce and payroll."}
            </p>
          </div>
          <form
            className="authForm"
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
                    setupKey: owner ? f.get("setupKey") : "",
                  }),
                });
                const d: any = await r.json();
                if (!r.ok)
                  throw Error(
                    d.error || "Unable to sign in. Please try again.",
                  );
                location.assign("/");
              } catch (e: any) {
                setError(e.message || "Unable to connect. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="authField">
              <label htmlFor="authEmail">Email address</label>
              <input
                id="authEmail"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                disabled={busy}
              />
            </div>
            <div className="authField">
              <label htmlFor="authPassword">Password</label>
              <div className="authPassword">
                <input
                  id="authPassword"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                  disabled={busy}
                  aria-describedby={register ? "authPasswordHint" : undefined}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {register && (
                <small id="authPasswordHint">Use 12–128 characters.</small>
              )}
            </div>
            {register && (
              <div className="authOwner">
                <label className="authOwnerToggle">
                  <input
                    type="checkbox"
                    checked={owner}
                    disabled={busy}
                    onChange={(e) => {
                      setOwner(e.target.checked);
                      setError("");
                    }}
                  />
                  <span>I’m setting up the owner account</span>
                </label>
                {owner && (
                  <div className="authOwnerDetails">
                    <div className="authField">
                      <label htmlFor="authSetupKey">
                        Private owner setup key
                      </label>
                      <div className="authPassword">
                        <input
                          id="authSetupKey"
                          name="setupKey"
                          type={showKey ? "text" : "password"}
                          required
                          minLength={24}
                          autoComplete="off"
                          spellCheck={false}
                          disabled={busy}
                          placeholder="Paste your private setup key"
                          aria-describedby="authKeyHint"
                        />
                        <button
                          type="button"
                          aria-label={
                            showKey ? "Hide setup key" : "Show setup key"
                          }
                          aria-pressed={showKey}
                          onClick={() => setShowKey(!showKey)}
                        >
                          {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <small id="authKeyHint">
                        Use the exact value of SMARTPAYROLL_ADMIN_SETUP_KEY in
                        Netlify (at least 24 characters). Use the email
                        configured in SMARTPAYROLL_OWNER_EMAIL.
                      </small>
                    </div>
                    <p>
                      Changed the key in Netlify? Redeploy before trying again.
                      This key is only needed when creating the owner account.
                    </p>
                  </div>
                )}
              </div>
            )}
            {error && (
              <div className="authError" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <button className="authSubmit" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle size={18} className="authSpinner" />
                  Please wait…
                </>
              ) : (
                <>
                  {register ? "Create account" : "Sign in"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="authSwitch">
            {register ? "Already have an account?" : "New to SmartPayroll?"}{" "}
            <button type="button" onClick={() => mode(!register)}>
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="authDivider">
            <span>or</span>
          </div>
          <a className="authGuest" href="/">
            Continue with guest workspace <ArrowRight size={15} />
          </a>
          <p className="authGuestNote">
            Guest records stay with this browser. Sign in to return to your
            account workspace on another device.
          </p>
        </div>
      </div>
    </main>
  );
}
