# Website audit and repair — 23 October 2026

## Scope and existing rules

Inspected all source routes, components, CSS, package scripts, TypeScript/ESLint configuration, Supabase schema/seed files, authentication, state storage, and original tests. This is Next.js 15 App Router with React 19, plain CSS, Zod, Supabase, and Vitest.

Active pages: `/`, `/tournament-tennis-1337-admin`, and the `/admin` redirect. API routes: public tournament GET, protected tournament/player PATCH, login POST, logout POST. Other bracket/match components exist but are currently unmounted; their nonexistent detail links and incorrect scoring were corrected without deleting the components. There are no implemented custom modals, registration/import workflow, participant removal, tournament creation UI, cancellation action, or reset/regeneration endpoint to exercise.

The live competition has 34 players, 17 doubles teams, four fixed corner teams, one preliminary play-in, and a 16-team main draw. Results are **aggregate set wins**, stored as array lengths, with allowed outcomes 2–0, 2–1, 0–2, 1–2; 0–0 means clear. The separate game-score helper follows the SQL scoring configuration's tiebreak-enabled best-of-three format. The generator requires at least four teams because it reserves four corners. Zero/single-team tournaments are rejected rather than assigned invented rules. There is no third-place match.

`public.tournament_state.state` is the authoritative live JSON document. The normalized SQL players/teams/matches tables are not the live bracket store. No production data, existing saved draw, database schema, or RLS policies were changed.

## Findings and repairs

| Severity | Actual issue and root cause | Repair |
| --- | --- | --- |
| Critical | A populated side could beat a missing opponent; the play-in placeholder could also be scored. The handler validated only the winning ID. | Require two different eligible teams before accepting a played result, with server validation and disabled UI controls. |
| Critical | Play-in corrections replaced a first-round participant without clearing that match or its downstream winners. | Find the play-in's first-round destination; clear its result and the complete affected path before advancing/restoring a placeholder. |
| Critical | Unconditional JSON upserts allowed concurrent edits and first-read initialization to overwrite another admin's results. | Conflict-safe initialization and an atomic update conditioned on the stored `updated_at` revision. Client revisions reject stale screens with HTTP 409. |
| High | Repeated identical scores erased subsequent results. | Idempotent results preserve later matches; a synchronous client guard blocks duplicate in-flight clicks. |
| High | Tournament status never advanced with results. | Derive upcoming/in-progress/completed after result changes and clears. Explicit admin corrections remain available after completion, as the existing workflow requires. |
| High | Later-round pending slots were labeled byes, and only first-round byes advanced. Duplicate IDs/members were accepted. | Distinguish unresolved feeders from resolved empty branches; propagate real byes, validate team/player IDs, and replay bye paths after corrections. |
| High | Module-level randomness changed the preview/draw across processes, undermining stable team IDs and hydration. | Reproducible preview/initial seed. Existing database draws remain untouched. |
| High | Legacy player PATCH wrote a disconnected SQL record, leaving the public bracket unchanged. | Route both rename endpoints through authoritative tournament state and revision checks; propagate the stable player ID through match copies. |
| Medium | Editor state survived participant/result changes; Team B wins initialized with no selected result. | Reinitialize affected editors using their match data identity and initialize both winning sides. Disable saves until loading succeeds; offer retry and show conflicts/errors. |
| Medium | Three side rounds occupied four CSS columns, and reversed right-side matches inverted the corner ordering. | Use the actual number of side rounds and preserve match-position ordering. |
| Medium | Trophy/caption heights moved the final below its semifinals. Narrow-screen rules split the mirrored bracket and shrank cards. | Equal vertical space around the final; consistent mirrored board with a contained, focusable horizontal scroll region on smaller screens. |
| Medium | A later tablet rule overrode the narrow mobile play-in layout. | Restore a single-column play-in at narrow widths; contain long labels and schedule metadata. |
| Medium | Invalid date strings were accepted; public time depended on the deployment server timezone. | Validate offset-aware timestamps, guard date rendering in editors, and display public schedules in Africa/Casablanca. Admin datetime inputs explicitly use local time. |
| Medium | Logout redirected to a hardcoded production domain, then browser testing exposed hostname normalization with an absolute request-based redirect. | Use a relative HTTP 303 Location and expire the session cookie. |
| Low | Broken navigation anchors, links to nonexistent detail routes, inconsistent dormant score calculations, hidden loading errors, weak focus/disabled feedback, and CSS compatibility warnings. | Correct navigation, render valid non-link content, use aggregate scores consistently, add an error boundary/alerts/focus states, improve dark-theme text contrast and touch targets, and use supported flex alignment values. |
| Low | README referenced a missing environment template; Avatar imported the whole randomized tournament module. | Add a secret-free `.env.example`; isolate avatar filename generation and use fixed-size Next Image with existing unoptimized local assets/fallbacks. |

## Verification

Original baseline: 6 tests passed; lint had two warnings. Final suite: **83 tests in 6 files**. Added 77 focused tests for score validation, complete 17-team progression, N−1 played-match invariants, counts 4–64, odd/non-power-of-two draws, byes, corrections/replays, clears/restarts, idempotency, immutable state, serialization, renames, scheduling, storage races/failures, session signing/expiry, authorization, stale revisions, and API errors.

Commands executed:

- `npm test`: 83 passed.
- `npm run lint`: passed without warnings.
- `npx tsc --noEmit`: passed.
- `npm run build`: successful; initial flex alignment warnings were repaired before the final build.
- `git diff --check`: passed.
- `npm audit --json`: completed with advisories; see remaining risks below. The initial sandboxed attempt failed with DNS access denied and was rerun with approved network access.

Real Chromium browser checks use `scripts/audit-browser.mjs`. Playwright and Chromium were installed only in `/private/tmp/kos-browser`, without changing package dependencies or the lockfile. The local server uses an empty service-role key and a test-only session secret. Browser tests use a locally signed test session; they do not use production admin credentials.

Completed 19 route/viewport combinations: bracket and authenticated dashboard at **320, 375, 430, 768, 1024, 1280, 1440, 1920px**; login at 320, 768, 1440px. Checks cover page overflow, all 15 main-draw cards and 16 admin editors, centered final/semifinal alignment, keyboard bracket scrolling, reachability of the rightmost matches, the admin alias, unauthorized writes, repeatable preview reads, Team B score initialization, disabled unresolved/play-in slots, failed saves preserving recorded results, stale-write refresh, failed loading/retry, and same-origin logout. Console/runtime errors and failed player-image requests are checked. Screenshots and JSON measurements are saved in `/private/tmp/kos-audit`; desktop/mobile bracket and mobile dashboard/login screenshots were also visually inspected.

Browser save-failure/conflict scenarios use intercepted responses. Storage persistence/concurrency tests mock Supabase query responses. These are not claims of a live database integration test. An intermediate screenshot run exposed a harness race: Playwright hid input carets before hydration finished. The harness now waits for the hydrated dashboard's enabled controls before capturing screenshots.

## Files changed

- Rules/storage: `src/lib/bracket.ts`, `src/lib/demo-data.ts`, `src/lib/types.ts`, `src/lib/tournament-store.ts`, new `src/lib/tournament-actions.ts`.
- API/security: `src/app/api/admin/tournament/route.ts`, `src/app/api/admin/players/route.ts`, `src/app/api/admin/logout/route.ts`, `src/lib/admin-session.ts`.
- Pages/styles: `src/app/page.tsx`, `src/app/globals.css`, `src/app/tournament-tennis-1337-admin/page.tsx`, new `src/app/error.tsx`.
- Components: `admin-tools.tsx`, `admin-dashboard.tsx`, `admin-login.tsx`, `avatar.tsx`, `bracket-view.tsx`, `match-card.tsx` in `src/components`.
- Tests/tooling/docs: new `tests/tournament-actions.test.ts`, `tests/tournament-store.test.ts`, `tests/tournament-api.test.ts`, `tests/admin-session.test.ts`, updated `tests/tournament-seed.test.ts`, `vitest.config.ts`, `scripts/audit-browser.mjs`, `.env.example`, `AUDIT.md`; updated `.gitignore`, `README.md`.

A concurrent edit changed `src/lib/player-logins.ts` from `ayaarab` to `aait-idi` during the audit. That edit was preserved. The new login has no supplied portrait; the seed uses the existing default image, and a regression test checks that all seeded image paths exist. The player-list replacement itself was not made by this audit. Admin player options now come from the loaded saved roster, so an existing tournament can still manage its original participants after source-list edits. The normalized SQL seed still contains `ayaarab`; neither that historical seed nor an existing persisted roster was migrated to the replacement login. Applying that identity change to a live competition requires a separate decision.

## Remaining risks and limits

- Registry audit reported **10 affected package entries: 2 critical, 6 high, 2 moderate**, including transitive development-tool issues in Vitest/tinypool and Next/ESLint-related PostCSS/globbing dependencies. Suggested fixes include major-version changes (and an ESLint configuration downgrade). No force upgrade or unverified transitive override was applied. A compatible framework/test-tool upgrade remains necessary; an advisory does not establish that the public bracket exposes the affected development-tool feature.
- SQL/RLS was reviewed statically. Live database constraints, production policies, audit writes, transactional behavior, and persistence through actual Supabase writes were not exercised. Admin mutation plus audit insertion are still separate operations; the response distinguishes audit failure from a successful saved result.
- Historical stored inconsistencies were not automatically rewritten. Existing invalid results need an admin review/correction; the repaired correction path clears affected descendants.
- Login has no application-level distributed rate limiter. Hosting-level rate limiting should be checked before public deployment; no new authentication policy or infrastructure was introduced.
- The JSON store remains a trusted server-owned document; there is no migration to relational match storage or comprehensive database-enforced bracket constraint system.
- Browser verification was Chromium on a local development server with the real fixed-size draw. Larger draws were verified in unit tests, not alternate rendered production tournaments. Cross-browser checks, screen-reader testing, large-text/zoom review, exhaustive contrast certification, real concurrent database writers, and a hosted deployment smoke test remain unverified.
- Public results refresh on page reload; realtime push/polling was not part of the existing implementation. There is no tournament-wide reset/regeneration UI; clear/replay logic was tested through the existing score actions and fresh generator calls.
- The UI and authoritative store use aggregate sets. Migrating to individual game scores, advantage sets, a deciding match tiebreak, variable tournament formats, or importing/reseeding an existing live draw requires a product/data decision. No such migration was performed.

To reproduce the optional browser run, install Playwright externally and set `PLAYWRIGHT_MODULE` to its `index.mjs` and `PLAYWRIGHT_BROWSERS_PATH` to its browser cache. Start the local app with `SUPABASE_SERVICE_ROLE_KEY='' ADMIN_SESSION_SECRET='kos-local-browser-verification-secret-only' npm run dev -- --hostname 127.0.0.1 --port 3100`, then run `node scripts/audit-browser.mjs` with those Playwright variables. Do not use the test session secret in a deployed environment.
