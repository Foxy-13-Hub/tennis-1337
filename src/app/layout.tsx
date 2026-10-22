import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "1337 MED Tournament · 1337 Tennis",
  description: "1337 MED Tournament — the 1337 community tennis tournament."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
