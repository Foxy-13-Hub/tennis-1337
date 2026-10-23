// Run against a local preview with the test session secret below and Supabase
// service-role credentials disabled. Playwright may be installed externally.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.AUDIT_ORIGIN || 'http://127.0.0.1:3100';
const output = process.env.AUDIT_OUTPUT || '/private/tmp/kos-audit';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [], measurements = [], assetFailures = [];
let checkingLayout = false;
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (checkingLayout && message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.url().includes('/players/') && response.status() >= 400) assetFailures.push(response.url()); });
async function measure(route, width, label) {
  checkingLayout = true;
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin}${route}`);
  await page.locator('h1').waitFor();
  if (label === 'dashboard') await page.waitForFunction(() => { const button = document.querySelector('#players button'); return button && !button.disabled; });
  await page.evaluate(() => Promise.all(Array.from(document.images, image => image.decode().catch(() => {}))));
  await page.screenshot({ path: `${output}/${label}-${width}.png`, fullPage: label !== 'dashboard' });
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    matches: document.querySelectorAll('.draw-match').length,
    board: (() => { const node = document.querySelector('.draw-board'); return node ? { client: node.clientWidth, scroll: node.scrollWidth } : null; })(),
    final: (() => { const node = document.querySelector('.draw-final-column'); if (!node) return null; const rect = node.getBoundingClientRect(); return { center: rect.x + rect.width / 2 }; })(),
  }));
  assert(metrics.scrollWidth <= width + 1, `${label} overflows at ${width}: ${metrics.scrollWidth}`);
  if (label === 'bracket') {
    assert.equal(metrics.matches, 15);
    if (width >= 1920) {
      assert(Math.abs(metrics.final.center - width / 2) <= 2, 'Final is not centered');
      const centers = await page.evaluate(() => Array.from(document.querySelectorAll('.round-depth-3 .draw-match, .draw-final-stage .draw-match'), node => { const rect = node.getBoundingClientRect(); return rect.y + rect.height / 2; }));
      assert(Math.max(...centers) - Math.min(...centers) <= 2, 'Final is not aligned with semifinals');
    }
    await page.locator('.draw-board').focus();
    if (metrics.board.scroll > width) {
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.draw-board').scrollLeft > 0);
    }
    await page.locator('.draw-board').evaluate(node => { node.scrollLeft = node.scrollWidth; });
    assert(await page.locator('.draw-right .draw-match').last().evaluate(node => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1; }));
  }
  measurements.push({ label, ...metrics });
  checkingLayout = false;
}
const widths = [320, 375, 430, 768, 1024, 1280, 1440, 1920];
try {
  for (const width of widths) await measure('/', width, 'bracket');
  for (const width of [320, 768, 1440]) await measure('/tournament-tennis-1337-admin', width, 'login');
  await page.goto(`${origin}/admin`);
  await page.waitForURL('**/tournament-tennis-1337-admin');
  assert.equal((await context.request.patch(`${origin}/api/admin/tournament`, { data: {} })).status(), 403);
  const first = await (await context.request.get(`${origin}/api/tournament`)).json();
  const second = await (await context.request.get(`${origin}/api/tournament`)).json();
  assert.deepEqual(first, second, 'Preview changed between reloads');
  const payload = Buffer.from(JSON.stringify({ login: 'amissa', exp: Date.now() + 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', 'kos-local-browser-verification-secret-only').update(payload).digest('base64url');
  await context.addCookies([{ name: '1337_tennis_admin', value: `${payload}.${signature}`, url: origin, httpOnly: true, sameSite: 'Lax' }]);
  for (const width of widths) await measure('/tournament-tennis-1337-admin', width, 'dashboard');
  assert.equal(await page.locator('#schedule article').count(), 16);
  const unresolved = page.locator('#schedule article').filter({ hasText: 'R2 · Match 1' });
  await unresolved.getByLabel('Final sets score').selectOption('2:0');
  assert(await unresolved.getByRole('button', { name: 'Save score / correction' }).isDisabled());
  const placeholder = page.locator('#schedule article').filter({ hasText: 'Play-in winner / Play-in winner' });
  await placeholder.getByLabel('Final sets score').selectOption('0:2');
  assert(await placeholder.getByRole('button', { name: 'Save score / correction' }).isDisabled());
  // A previously saved Team B result must initialize the select correctly.
  const saved = structuredClone(first);
  saved.revision = '2026-10-23T10:00:00.000Z';
  const legacyPlayer = saved.teams.flatMap(team => team.players).find(player => player.login === 'aait-idi');
  if (legacyPlayer) { legacyPlayer.login = 'ait-idi'; legacyPlayer.name = 'Saved player display name'; }
  saved.matches[0].setsA = [1]; saved.matches[0].setsB = [1, 1];
  saved.matches[0].status = 'completed'; saved.matches[0].winnerId = saved.matches[0].teamB.id;
  await page.route('**/api/tournament', route => route.fulfill({ json: saved }));
  await page.reload();
  const completed = page.locator('#schedule article').filter({ hasText: 'R1 · Match 1 ·' });
  await page.waitForFunction(() => !document.body.textContent.includes('Loading saved tournament'));
  assert.equal(await completed.getByLabel('Final sets score').inputValue(), '1:2');
  if (legacyPlayer) {
    await page.getByLabel('Player login').selectOption('ait-idi');
    assert.equal(await page.getByLabel('Display name').inputValue(), 'Saved player display name');
    assert.equal(await page.getByLabel('Player login').locator('option[value="aait-idi"]').count(), 0);
  }
  await page.route('**/api/admin/tournament', route => route.fulfill({ status: 503, json: { error: 'Simulated storage failure' } }));
  await completed.getByLabel('Final sets score').selectOption('2:1');
  await completed.getByRole('button', { name: 'Save score / correction' }).click();
  await page.getByRole('status').filter({ hasText: 'Simulated storage failure' }).waitFor();
  assert(await completed.getByText('Recorded · 1:2').isVisible());
  await page.unroute('**/api/admin/tournament');
  await page.route('**/api/admin/tournament', route => route.fulfill({ status: 409, json: { error: 'The tournament changed. Reload before saving.' } }));
  await completed.getByRole('button', { name: 'Save score / correction' }).click();
  await page.getByRole('status').filter({ hasText: 'The tournament changed' }).waitFor();
  await page.unroute('**/api/admin/tournament');
  // A failed initial read disables all mutation buttons and offers a retry.
  await page.unroute('**/api/tournament');
  await page.route('**/api/tournament', route => route.fulfill({ status: 503, json: { error: 'Simulated load failure' } }));
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Simulated load failure' }).waitFor();
  assert(await page.getByRole('button', { name: 'Save player name' }).isDisabled());
  assert(await page.locator('#schedule article button:enabled').count() === 0);
  await page.unroute('**/api/tournament');
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await page.waitForFunction(() => !document.body.textContent.includes('Loading saved tournament'));
  const logout = await context.request.post(`${origin}/api/admin/logout`, { maxRedirects: 0 });
  assert.equal(logout.status(), 303);
  assert.equal(new URL(logout.headers().location, origin).origin, origin);
  assert.deepEqual(errors, [], 'Browser runtime or console errors');
  assert.deepEqual(assetFailures, [], 'Failed player image requests');
  await writeFile(`${output}/results.json`, JSON.stringify({ measurements, errors, checks: ['alias redirect', 'anonymous write denied', 'stable preview reload', '16 match editors', 'unresolved and placeholder score disabled', 'Team B score initialization', 'saved roster drives rename controls', 'save failure preserves recorded result', 'conflict refresh', 'load failure disables writes', 'retry loading', 'same-origin logout'] }, null, 2));
  console.log(`PASS: ${measurements.length} route/viewport checks; interactions passed; no page errors. Artifacts: ${output}`);
} finally { await browser.close(); }
