import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AdminLogin } from "@/components/admin-login";
import { getAdminSession } from "@/lib/admin-session";
import { AdminDashboard } from "@/components/admin-dashboard";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
 const profile = await getAdminSession();
 return <div className="site-shell"><SiteHeader/><main className="container">
  <div className="section" style={{paddingBottom:10}}><div className="section-kicker">Restricted area</div><h1 style={{fontSize:"clamp(32px,5vw,52px)",letterSpacing:"-.06em",margin:"8px 0"}}>Tournament control room</h1><p className="player-meta" style={{maxWidth:620}}>Manage the tournament using one of the three authorized admin profiles.</p></div>
  {profile ? <AdminDashboard profile={profile}/> : <AdminLogin configured={!!process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 32}/>}
 </main><SiteFooter/></div>;
}
