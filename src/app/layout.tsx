import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OFFICIAL 1337 MED TOURNAMENT ",
  description: "OFFICIAL 1337 MED TOURNAMENT  — the 1337 community tennis tournament."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
