import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALIGN Operational Suite",
  description: "Inventory day stock counting and reconciliation suite.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
