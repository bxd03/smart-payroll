"use client";
import { useEffect, useState } from "react";
import { Download, Smartphone, WifiOff, X } from "lucide-react";
export default function Pwa() {
  const [prompt, setPrompt] = useState<any>(null),
    [installed, setInstalled] = useState(false),
    [help, setHelp] = useState(false),
    [offline, setOffline] = useState(false),
    [warning, setWarning] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    setInstalled(media.matches || (navigator as any).standalone === true);
    setOffline(!navigator.onLine);
    const online = () => setOffline(!navigator.onLine);
    const before = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    const after = () => {
      setInstalled(true);
      setPrompt(null);
      setHelp(false);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", after);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() =>
          setWarning(
            "Installation is unavailable in this browser. You can still use SmartPayroll online.",
          ),
        );
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", after);
    };
  }, []);
  async function install() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else setHelp(true);
  }
  return (
    <>
      {offline && (
        <div className="pwaOffline" role="status">
          <WifiOff size={16} /> You’re offline. Reconnect before saving or
          uploading records.
        </div>
      )}
      {!installed && (
        <button className="pwaInstall" onClick={install}>
          <Smartphone size={16} /> Install app
        </button>
      )}
      {help && (
        <div className="overlay">
          <section
            className="modal pwaHelp"
            role="dialog"
            aria-modal="true"
            aria-label="Install SmartPayroll"
          >
            <div className="modalHead">
              <h2>SmartPayroll on your phone</h2>
              <button
                aria-label="Close install instructions"
                onClick={() => setHelp(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="cardBody">
              <p>
                <b>Android:</b> Open this link in Chrome. Tap the menu (⋮), then{" "}
                <b>Install app</b> or <b>Add to Home screen</b>.
              </p>
              <p>
                <b>iPhone:</b> Open this link in Safari. Tap <b>Share</b>, then{" "}
                <b>Add to Home Screen</b> and <b>Add</b>.
              </p>
              <p>
                SmartPayroll opens from your home screen in its own app window.
                Internet is needed to load and save records.
              </p>
              {warning && <p role="status">{warning}</p>}
              <button className="btn full" onClick={() => setHelp(false)}>
                Got it
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
