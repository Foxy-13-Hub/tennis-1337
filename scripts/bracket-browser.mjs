// Run after npm run build. All data lives in isolated HTTP storage.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { startTestStorage } from './live-test-storage.mjs';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const storage=await startTestStorage(),origin='http://127.0.0.1:3199';
const output='/private/tmp/tennis-bracket-tests';await mkdir(output,{recursive:true});
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3199','-H','127.0.0.1'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:storage.url,SUPABASE_SERVICE_ROLE_KEY:'isolated-test-key',ADMIN_SESSION_SECRET:'bracket-test-secret-at-least-32-characters',ADMIN_NEL_KHAL_PASSWORD:'test-password'},stdio:['ignore','pipe','pipe']});
let logs='',browser;app.stdout.on('data',d=>logs+=d);app.stderr.on('data',d=>logs+=d);
const checks=[],errors=[];
checks.push = (...items) => { for (const item of items) console.log("PASS:",item); return Array.prototype.push.apply(checks,items); };
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/tournament')).ok)break;}catch{}if(app.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,200));}
 assert(storage.snapshot(),"Application must use isolated storage before browser edits");
 browser=await chromium.launch();const admin=await browser.newPage(),pub=await browser.newPage();
 for(const p of [admin,pub])p.on('pageerror',e=>errors.push(e.message));
 await admin.goto(origin+'/tournament-tennis-1337-admin');await admin.getByLabel('Password',{exact:true}).fill('test-password');await admin.getByRole('button',{name:'Sign in securely'}).click();
 await admin.locator('[data-admin-match="r4-m1"]').waitFor();assert.equal(await admin.locator('[data-admin-match]').count(),16);checks.push('admin renders play-in, all 15 main matches and every round');
 let state=await(await fetch(origin+'/api/tournament')).json();const original=structuredClone(state),target=state.matches[0].teamA;
 const card=()=>admin.locator('[data-admin-match="r1-m1"]');
 async function open(){await card().getByRole('button',{name:'Edit Team',exact:true}).first().click();await admin.getByRole('dialog').waitFor();}
 async function save(accept=true){const question=admin.waitForEvent('dialog');await admin.getByRole('dialog').getByRole('button',{name:'Save Changes',exact:true}).click();const dialog=await question;assert.match(dialog.message(),/Review changes/);await(accept?dialog.accept():dialog.dismiss());if(accept)await admin.getByRole('dialog').waitFor({state:'hidden'});}
 await open();await admin.getByLabel('Player 1',{exact:true}).selectOption(state.teams.find(t=>t.id!==target.id).players[0].id);await admin.getByRole('dialog').getByRole('button',{name:'Save Changes',exact:true}).click();await admin.getByRole('dialog').getByRole('status').filter({hasText:'is assigned to'}).waitFor();checks.push('occupied player assignment rejected with conflict explanation');
 await admin.getByLabel('Allow swaps with existing assignments').check();await save(false);assert.deepEqual(storage.snapshot().state.teams,original.teams);checks.push('dismissed preview writes nothing');await save();
 state=await(await fetch(origin+'/api/tournament')).json();let edited=state.teams.find(t=>t.id===target.id);assert.equal(edited.players[1].id,target.players[1].id);assert.notEqual(edited.players[0].id,target.players[0].id);checks.push('one-player swap saves through real API and store');
 await pub.goto(origin);await pub.locator('[data-match-id="r1-m1"]').getByText(edited.players[0].name,{exact:true}).waitFor();
 await open();const donors=state.teams.filter(t=>t.id!==target.id);await admin.getByLabel('Team name',{exact:true}).fill('Browser verified doubles');await admin.getByLabel('Player 1',{exact:true}).selectOption(donors[0].players[0].id);await admin.getByLabel('Player 2',{exact:true}).selectOption(donors[1].players[1].id);await admin.getByLabel('Allow swaps with existing assignments').check();await save();
 await pub.getByText('Browser verified doubles',{exact:true}).first().waitFor();await admin.reload();await card().getByText('Browser verified doubles',{exact:true}).waitFor();await pub.reload();await pub.getByText('Browser verified doubles',{exact:true}).first().waitFor();checks.push('both-player replacement persists through reload and automatically updates separate public browser');
 await open();await admin.getByLabel('Team name',{exact:true}).fill('Discard me');admin.once('dialog',d=>d.dismiss());await admin.getByRole('button',{name:'Cancel',exact:true}).click();assert(await admin.getByRole('dialog').isVisible());admin.once('dialog',d=>d.accept());await admin.getByRole('button',{name:'Cancel',exact:true}).click();await admin.getByRole('dialog').waitFor({state:'hidden'});checks.push('cancel requires explicit discard for unsaved changes');
 state=await(await fetch(origin+'/api/tournament')).json();const a=state.matches[0],b=state.matches[1];
 await card().getByRole('button',{name:'Edit Match Slots',exact:true}).click();await admin.getByLabel('Team A',{exact:true}).selectOption(b.teamA.id);await admin.getByLabel('Allow swaps with existing assignments').check();await save();state=await(await fetch(origin+'/api/tournament')).json();assert.equal(state.matches[0].teamA.id,b.teamA.id);assert.equal(state.matches[1].teamA.id,a.teamA.id);checks.push('occupied match slots swap atomically');
 const api=async(body)=>{const s=await(await fetch(origin+'/api/tournament')).json();return admin.request.patch(origin+'/api/admin/tournament',{data:{...body,revision:s.revision}});};
 for(const m of [state.playInMatch,...state.matches]){const r=await api({action:'score',matchId:m.id,setsA:2,setsB:0});assert.equal(r.status(),200);}
 state=await(await fetch(origin+'/api/tournament')).json();assert.equal(state.status,'completed');await admin.reload();await admin.getByText('Champion:',{exact:false}).waitFor();checks.push('play-in and entire knockout progress through real API to consistent champion');
 const team=state.matches[0].teamA,other=state.matches[0].teamB,body={action:'editTeam',teamId:team.id,name:team.name,playerIds:[other.players[0].id,team.players[1].id],swapConflicts:true};
 const preview=await api({...body,preview:true});assert.equal(preview.status(),200);assert((await preview.json()).impacts.some(x=>x.startsWith('r4-m1:')));assert.equal((await api(body)).status(),422);checks.push('server preview detects final reset and rejects missing explicit confirmation');
 await card().getByRole('button',{name:'Edit Team',exact:true}).first().click();await admin.getByLabel('Player 1',{exact:true}).selectOption(other.players[0].id);await admin.getByLabel('Allow swaps with existing assignments').check();const confirmation=admin.waitForEvent('dialog');await admin.getByRole('dialog').getByRole('button',{name:'Save Changes',exact:true}).click();const d=await confirmation;assert.match(d.message(),/r4-m1:/);await d.accept();await admin.getByRole('dialog').waitFor({state:'hidden'});assert.equal(storage.snapshot().state.matches.find(m=>m.round===4).winnerId,undefined);checks.push('UI explicitly confirms downstream result resets and removes outdated champion');
 assert.equal((await pub.request.patch(origin+'/api/admin/tournament',{data:body})).status(),403);assert.equal((await api({...body,playerIds:['foreign','missing']})).status(),400);checks.push('unauthorized and invalid direct writes rejected');
 for(const width of [320,768,1440]){await admin.setViewportSize({width,height:900});assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await admin.screenshot({path:`${output}/admin-${width}.png`});}
 checks.push('admin bracket fits mobile, tablet and desktop');assert.deepEqual(errors,[]);await writeFile(output+'/results.json',JSON.stringify({checks,errors},null,2));console.log(`PASS: ${checks.length} bracket browser checks; no page errors. Artifacts: ${output}`);
}catch(e){console.error(logs);throw e;}finally{await browser?.close();app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));await storage.close();}
