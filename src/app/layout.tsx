import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "1337 MED Tournament",
  description: "Official 1337 MED Tournament bracket, fixtures, and results."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
