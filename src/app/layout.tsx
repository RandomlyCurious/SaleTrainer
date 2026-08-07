import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Template Vibe Coding",
  description: "Base Next.js + Supabase + TDD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Pas de next/font/google : évite un appel réseau au build (CI plus stable).
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
