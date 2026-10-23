// Build first, then run: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/live-browser.mjs
// Uses a fresh, isolated HTTP storage fixture; no production credentials/data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { startTestStorage } from './live-test-storage.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const storage = await startTestStorage();
const origin = 'http://127.0.0.1:3198';
const output = process.env.LIVE_TEST_OUTPUT || '/private/tmp/tennis-live-tests';
await mkdir(output, { recursive: true });
let logs = '';
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3198', '-H', '127.0.0.1'], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: storage.url, SUPABASE_SERVICE_ROLE_KEY: 'isolated-test-key',
    ADMIN_SESSION_SECRET: 'live-browser-test-secret-at-least-32-chars', ADMIN_NEL_KHAL_PASSWORD: 'live-browser-test-password' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
app.stdout.on('data', data => { logs += data; });app.stderr.on('data', data => { logs += data; });
let browser;
const checks = [], errors = [];
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/api/tournament')).ok) break; } catch {}
    if (app.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch();
  const adminContext = await browser.newContext(); const publicContext = await browser.newContext();
  const admin = await adminContext.newPage(), pub = await publicContext.newPage();
  for (const page of [admin,pub]) page.on('pageerror', error => errors.push(error.message));
  await admin.goto(origin + '/tournament-tennis-1337-admin');
  await admin.getByLabel('Password', { exact: true }).fill('live-browser-test-password');
  await admin.getByRole('button', { name: 'Sign in securely' }).click();
  await admin.getByRole('heading', { name: 'Manage the live bracket' }).waitFor();
  const editor = () => admin.locator('#schedule article').filter({hasText:'R1 · Match 1 ·'});
  await editor().getByRole('button',{name:'Start Match',exact:true}).click();
  await editor().getByText('Match status: LIVE', {exact:true}).waitFor();
  assert.equal(await editor().getByText('Saved: 0 [0]', {exact:true}).count(),2);
  checks.push('authenticated start persists LIVE and both 0 [0] scores');
  await pub.goto(origin);
  const card=()=>pub.locator('[data-match-id="r1-m1"]');
  await card().getByText('● LIVE',{exact:true}).waitFor();
  assert.equal(await pub.getByRole('button',{name:'Save Score',exact:true}).count(),0);
  checks.push('separate public browser context shows LIVE without editing controls');
  async function bump(side,times=1){for(let i=0;i<times;i++)await editor().getByRole('button',{name:`Increase Team ${side} games`,exact:true}).click();}
  async function save(){await editor().getByRole('button',{name:'Save Score',exact:true}).click();await editor().getByText('Showing saved score.',{exact:true}).waitFor();}
  await bump('A');await editor().getByText('Unsaved changes — public score is unchanged.',{exact:true}).waitFor();
  assert.equal(await card().getByText('0 [1]',{exact:true}).count(),0);
  await save();await card().getByText('0 [1]',{exact:true}).waitFor();
  await bump('A');await bump('B');await save();await card().getByText('0 [2]',{exact:true}).waitFor();await card().getByText('0 [1]',{exact:true}).waitFor();
  checks.push('repeated successful saves propagate automatically; drafts remain private');
  await bump('A');storage.failWrite();await editor().getByRole('button',{name:'Save Score',exact:true}).click();
  await admin.getByRole('status').filter({hasText:'Tournament state could not be saved'}).waitFor();
  assert.equal(await editor().getByText('Saved: 0 [2]',{exact:true}).count(),1);assert.equal(await card().getByText('0 [3]',{exact:true}).count(),0);
  await save();await card().getByText('0 [3]',{exact:true}).waitFor();checks.push('save failure preserves last persisted score and retry succeeds');
  await editor().getByRole('button',{name:'Decrease Team A games',exact:true}).click();await save();await card().getByText('0 [2]',{exact:true}).waitFor();
  // A second admin tab edits the same revision; its older score must conflict.
  const stale=await adminContext.newPage();await stale.goto(origin+'/tournament-tennis-1337-admin');
  const staleEditor=stale.locator('#schedule article').filter({hasText:'R1 · Match 1 ·'});
  await staleEditor.getByRole('button',{name:'Increase Team A games',exact:true}).click();
  await bump('A');await save();
  await staleEditor.getByRole('button',{name:'Save Score',exact:true}).click();await stale.getByRole('status').filter({hasText:'The tournament changed'}).waitFor();await stale.close();
  checks.push('stale admin tab rejected and refreshed');
  admin.on('dialog', dialog=>dialog.accept());
  await editor().getByRole('button',{name:'End Match',exact:true}).click();
  await admin.getByRole('status').filter({hasText:'Record all valid sets'}).waitFor();
  checks.push('invalid match end rejected');
  await publicContext.setOffline(true);
  await bump('A');await save();
  await publicContext.setOffline(false);
  await card().getByText('0 [4]',{exact:true}).waitFor();checks.push('reconnection restores latest persisted score');
  await bump('A',2);await bump('B',2);await save();
  await editor().getByRole('button',{name:'Complete Set',exact:true}).click();
  await editor().getByText('Saved: 1 [0]',{exact:true}).waitFor();await card().getByText('1 [0]',{exact:true}).waitFor();
  await card().getByText('Sets: 6–3',{exact:true}).waitFor();
  checks.push('set completion records 6–3, increments sets and resets games');
  await bump('B',6);await save();await editor().getByRole('button',{name:'Complete Set',exact:true}).click();
  await editor().getByText('Saved: 1 [0]',{exact:true}).first().waitFor();
  // Wait for the reset after the second set, before editing the deciding set.
  await admin.waitForFunction(()=>document.querySelector('#schedule article:nth-child(2)')?.textContent.includes('Completed sets: 6–3, 0–6'));
  await bump('A',6);await bump('B');await save();await editor().getByRole('button',{name:'Complete Set',exact:true}).click();
  await editor().getByText('Saved: 2 [0]',{exact:true}).waitFor();
  await editor().getByRole('button',{name:'End Match',exact:true}).click();
  await editor().getByText('Match status: COMPLETED',{exact:true}).waitFor();
  await card().getByText('FINAL',{exact:true}).waitFor();assert.equal(await card().getByText('● LIVE',{exact:true}).count(),0);
  await card().getByText('Sets: 6–3, 0–6, 6–1',{exact:true}).waitFor();
  assert.equal(await editor().getByRole('button',{name:'Save Score',exact:true}).count(),0);
  const committed=await (await publicContext.request.get(origin+'/api/tournament')).json();
  assert.equal(committed.matches.find(m=>m.id==='r2-m1').teamA.id,committed.matches[0].winnerId);
  checks.push('validated match completion persists history, removes LIVE, and advances winner');
  await admin.reload();await pub.reload();await editor().getByText('Match status: COMPLETED',{exact:true}).waitFor();await card().getByText('2 [0]',{exact:true}).waitFor();
  checks.push('admin and public reload preserve final result');
  const response=await publicContext.request.patch(origin+'/api/admin/tournament',{data:{action:'liveScore',matchId:'r1-m1',gamesA:99,gamesB:0,revision:committed.revision}});
  assert.equal(response.status(),403);assert.deepEqual(storage.snapshot().state.matches[0],committed.matches[0]);
  checks.push('anonymous direct API modification rejected without changing storage');
  // Keep another match LIVE for responsive checks of the score controls.
  const next=admin.locator('#schedule article').filter({hasText:'R1 · Match 2 ·'});await next.getByRole('button',{name:'Start Match',exact:true}).click();await next.getByText('Match status: LIVE',{exact:true}).waitFor();
  await pub.locator('[data-match-id="r1-m2"]').getByText('● LIVE',{exact:true}).waitFor();
  const playInEditor=admin.locator('#schedule article').filter({hasText:'PLAY-IN ·'});
  await playInEditor.getByRole('button',{name:'Start Match',exact:true}).click();
  await playInEditor.getByText('Match status: LIVE',{exact:true}).waitFor();
  const playInPublic=pub.getByRole('region',{name:'Preliminary match for slot 16'});
  await playInPublic.getByText('Team A · 0 [0]',{exact:true}).waitFor();
  await playInEditor.getByRole('button',{name:'Increase Team B games',exact:true}).click();
  await playInEditor.getByRole('button',{name:'Save Score',exact:true}).click();
  await playInPublic.getByText('Team B · 0 [1]',{exact:true}).waitFor();
  checks.push('play-in independently starts and propagates saved live games');
  for(const width of [320,768,1440]){
    for(const [page,label] of [[admin,'admin'],[pub,'public']]){
      await page.setViewportSize({width,height:900});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} overflows at ${width}`);
      await page.screenshot({path:`${output}/${label}-${width}.png`,fullPage:label==='public'});
    }
  }
  checks.push('live controls and public bracket fit mobile, tablet and desktop widths');
  assert.deepEqual(errors,[]);
  await writeFile(output+'/results.json',JSON.stringify({checks,errors,storage:'isolated HTTP PostgREST test double; real application API and Supabase SDK'},null,2));
  console.log(`PASS: ${checks.length} live workflow checks; no page errors. Artifacts: ${output}`);
} catch(error){console.error(logs);throw error;}
finally {await browser?.close();app.kill('SIGTERM');await new Promise(resolve=>app.once('exit',resolve));await storage.close();}
