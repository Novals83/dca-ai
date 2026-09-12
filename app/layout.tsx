import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DCA AI — Hyperliquid Copilot",
  description:
    "Read-only portfolio intelligence and BTC + HYPE strategy simulations.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
