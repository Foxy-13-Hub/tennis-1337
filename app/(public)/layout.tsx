import { PublicNav } from "@/components/public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
