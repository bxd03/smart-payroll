"use client";
import { X, ArrowRight, Inbox, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";
export function Button({ children, variant = "", ...props }: any) {
  return (
    <button className={"btn " + variant} {...props}>
      {children}
    </button>
  );
}
export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: any) {
  return (
    <section className={"card " + className}>
      {title && (
        <div className="cardHead">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title = "Nothing here yet",
  description,
  action,
  icon: Icon = Inbox,
}: any) {
  return (
    <div className="empty">
      <span>
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Badge({ children, tone = "" }: any) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Field({ label, hint, children, ...props }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />} {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: any) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <div
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modalHead">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="iconBtn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Stat({
  label,
  value,
  description,
  icon: Icon,
  tone = "",
}: any) {
  return (
    <section className={"stat " + tone}>
      <div className="statTop">
        <span>{label}</span>
        <span className="statIcon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{description}</small>
    </section>
  );
}
export function Table({
  headers,
  children,
  empty = false,
  emptyText = "No records match these filters.",
}: any) {
  return (
    <div className="tableScroll">
      <table>
        <thead>
          <tr>
            {headers.map((h: string, i: number) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <Empty title="No records found" description={emptyText} />}
    </div>
  );
}
export function Person({ name, code }: any) {
  return (
    <div className="person">
      <span>
        {name
          ?.split(" ")
          .slice(0, 2)
          .map((s: string) => s[0])
          .join("")}
      </span>
      <div>
        <b>{name}</b>
        <small>{code}</small>
      </div>
    </div>
  );
}
