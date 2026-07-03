import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suite opérationnelle Cyncro",
  description: "Suite de comptage et de rapprochement des stocks pour les journées d'inventaire.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
