import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "1337 Tennis Tournament",
  description: "Public and admin tournament platform for 1337 doubles tennis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-black text-zinc-100">{children}</body>
    </html>
  );
}
