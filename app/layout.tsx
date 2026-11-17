import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SmartPayroll | Hours to payday",
  description: "Temporary worker attendance and payroll management",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
