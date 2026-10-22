import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/bracket", label: "Bracket" },
  { href: "/teams", label: "Teams" },
  { href: "/schedule", label: "Schedule" },
  { href: "/results", label: "Results" },
];

export function PublicNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 text-sm">
        <Link href="/" className="font-semibold tracking-wide text-white">
          1337 Tennis
        </Link>
        <nav className="flex flex-wrap gap-3 text-zinc-200">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="rounded px-2 py-1 hover:bg-white/10">
              {item.label}
            </Link>
          ))}
          <Link href="/tournament-tennis-1337-admin" className="rounded border border-white/20 px-2 py-1 hover:bg-white/10">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
