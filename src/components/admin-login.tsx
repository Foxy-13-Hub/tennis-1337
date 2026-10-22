"use client";
import { useState } from "react";
export function AdminLogin({configured}:{configured:boolean}) {
 const [login,setLogin]=useState("nel-khal"); const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent) { e.preventDefault(); setBusy(true); setMessage(""); try {
  const response=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({login,password})});
  const data=await response.json(); if(!response.ok) throw new Error(data.error||"Login failed."); window.location.reload();
 } catch(err) { setMessage(err instanceof Error?err.message:"Login failed."); } finally { setBusy(false); } }
 return <div className="panel" style={{maxWidth:480,margin:"15px 0 55px"}}><h2 style={{marginTop:0}}>Administrator login</h2><p className="player-meta">Only nel-khal, amissa, and bdebbagh can sign in.</p>{!configured&&<div className="note">Set a random ADMIN_SESSION_SECRET (at least 32 characters) in `.env.local`, add the three admin passwords, then restart the app.</div>}
 <form onSubmit={submit}><label className="field">Admin profile<select value={login} onChange={e=>setLogin(e.target.value)}><option value="nel-khal">nel-khal</option><option value="amissa">amissa</option><option value="bdebbagh">bdebbagh</option></select></label><label className="field">Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button className="primary-btn" disabled={busy||!configured}>{busy?"Signing in…":"Sign in securely"}</button></form>{message&&<p style={{color:"#b42318",fontSize:13}}>{message}</p>}</div>;
}
