import Link from "next/link";
export function SiteHeader() {
  return <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">1337</span><span>ayaarab with hhammiou</span></Link><nav className="nav"><Link className="admin-link pill" href="/tournament-tennis-1337-admin">Admin ↗</Link></nav></header>;
}
