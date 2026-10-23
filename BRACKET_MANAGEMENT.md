# Bracket management

Sign in at `/tournament-tennis-1337-admin` and select **Bracket Management**.

- The round links navigate through the play-in, Round of 16, quarter-finals, semi-finals and final. Each match displays both players, status, saved score, winner and advancement destination. The champion comes from the final result.
- **Edit Team** changes the team name or either player. Search by local name/login. If a selected player belongs to another team, enable **Allow swaps with existing assignments**; the displaced player moves into the donor team. Both teams retain two unique players. Login, avatar and display-name records travel unchanged with each player.
- **Edit Match Slots** corrects the initial draw or play-in participants. Enable swaps to exchange occupied positions. Slot 16 comes from the play-in result; later rounds come from feeder winners. Correct those results under **Match management** instead of assigning an unrelated team to a derived slot.
- **Save Changes** requests a server preview. Review every changed roster/slot and any saved results/live scores that must reset, then confirm. Canceling the preview does not write anything. Canceling a dirty editor requires a discard confirmation. Clicking outside the modal does not dismiss it; browser reload/navigation prompts before abandoning changes.
- Score corrections also preview affected saved results. Existing live-score operations remain available under Match management.

## Persistence and safety

All edits use the existing authenticated tournament PATCH endpoint and Supabase `tournament_state` document. The public page reads that same document and automatically refreshes on a newer revision. No new database migration is needed. Existing Supabase storage, service-role configuration and admin credentials remain required for persistent writes. Without storage the existing preview remains read-only.

The server validates local identities, conflicts, feeder restrictions and destructive confirmation. Previews do not write. Both preview and commit require the screen revision; the final database update also checks that revision atomically. A concurrent edit is rejected and the admin reloads the saved state. Review/retry the edit against the refreshed state. No automatic rollback/history is provided; result resets are explicit and cannot be undone automatically.

`rosterManaged` marks administrator-edited draws so the legacy play-in roster repair cannot overwrite intentional changes. Server storage/audit configuration is read at runtime to support isolated test servers.

## Verification

```
npm run lint
npx tsc --noEmit
npm test
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/bracket-browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/live-browser.mjs
```

The browser scripts run the production build with temporary localhost PostgREST storage, real application routes and the Supabase SDK. They assert isolated storage is active before editing. They do not use a real Supabase project. Set `PLAYWRIGHT_BROWSERS_PATH` if needed for an existing Chromium installation. Artifacts are written to `/private/tmp/tennis-bracket-tests` and `/private/tmp/tennis-live-tests`.

The bracket suite covers roster swaps, both-player replacement, conflicts, preview cancellation, unsaved-change protection, slot swaps, public updates, reload persistence, complete knockout progression, downstream confirmation, authorization, invalid inputs and responsive widths. Vitest covers the same domain/API rules, revision conflicts and unaffected-branch preservation. The existing live suite verifies game/set persistence, failures/retries, stale tabs, public reconnection, play-in advancement and mobile layouts.

## Changed files

- `src/components/bracket-management.tsx`: tournament view and roster/slot dialogs.
- `src/components/admin-tools.tsx`: shared server preview, confirmation, save feedback.
- `src/components/admin-dashboard.tsx`: navigation entry.
- `src/lib/bracket-edit.ts`: validated swaps, dependency reconciliation and result impacts.
- `src/lib/tournament-actions.ts`: integrates editing with existing actions.
- `src/app/api/admin/tournament/route.ts`: authenticated previews and confirmation enforcement.
- `src/lib/types.ts`, `src/lib/play-in-roster.ts`: managed-roster persistence flag.
- `src/lib/tournament-store.ts`, `src/lib/admin-audit.ts`: runtime server configuration.
- `src/app/page.tsx`, `src/app/globals.css`: custom team names on the public bracket and responsive admin styles.
- `tests/bracket-edit.test.ts`, `tests/tournament-api.test.ts`: domain/API regression tests.
- `scripts/bracket-browser.mjs`, `scripts/live-browser.mjs`: browser coverage and isolated-storage assertion.
- `BRACKET_MANAGEMENT.md`: usage and verification guide.

## Results from this implementation

- ESLint: passed.
- TypeScript (`npx tsc --noEmit`): passed.
- Vitest: 144 tests passed across 11 files.
- Production build (`npm run build`): passed.
- Bracket browser suite: 12 workflow checks passed, no page errors.
- Existing live browser suite: 19 workflow checks passed, no page errors.
- Browser responsive assertions: 320, 768 and 1440 pixels passed.
- `git diff --check`: passed.

The persistence/browser checks used isolated HTTP PostgREST fixtures through the real application and Supabase SDK. A real hosted Supabase project was not used for test writes. An initial confirmation regression and browser fixture/selector issues were fixed and the affected suites rerun successfully.
