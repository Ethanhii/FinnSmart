import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinnSmart — See how news ripples to your stocks",
  description:
    "A beginner-friendly financial intelligence app that maps each stock's suppliers, customers, partners and dependencies, then traces how the news ripples back.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
