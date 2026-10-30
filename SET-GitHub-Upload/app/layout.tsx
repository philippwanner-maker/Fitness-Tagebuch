import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SET — Dein Training. Dein Rhythmus.",
  description: "Persönliches Fitness-Tagebuch mit Freunden, Kalender und Fortschritt.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
