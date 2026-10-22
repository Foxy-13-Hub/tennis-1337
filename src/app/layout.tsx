import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ayaarab with hhammiou · 1337 Tennis",
  description: "ayaarab with hhammiou — the 1337 community tennis tournament."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
