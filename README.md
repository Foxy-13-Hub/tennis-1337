# 1337 Tennis Open na9a ki testi

A Next.js app with **two user-facing pages**:

- `/` — public tournament bracket only. The page shows a preliminary play-in and the mirrored 16-team knockout bracket with the final in the center.
- `/tournament-tennis-1337-admin` — protected admin login and dashboard.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set three strong admin passwords and a random `ADMIN_SESSION_SECRET` of at least 32 characters in `.env.local` before using the admin route. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

## Supabase setup

Run `supabase/schema.sql`, then `supabase/seed_players_teams.sql` in the Supabase SQL Editor. Configure the URL, publishable/anon key and service role key in `.env.local`.

## Live tournament operations

The public bracket and admin dashboard now read/write the same saved tournament state in Supabase. Run both SQL files in this order: `supabase/schema.sql`, then `supabase/seed_players_teams.sql`. The state row is initialized from the reproducible bundled draw the first time the server reads it; later changes persist in `public.tournament_state`.

From `/tournament-tennis-1337-admin`, an authorized admin can:

- Change any player's display name while keeping the original login/avatar filename.
- Set or change the date/time and court/place for every match, including the play-in.
- Start a pending match, save current-set games repeatedly, record completed sets, and explicitly end a match to advance the winner.
- Correct or clear a score. Later-round slots are cleared and can be recorded again after the correction.

The public page remains the bracket page only. The service-role key is used only on the server and must never be exposed to browser code. A Supabase service-role key and the SQL migration are required for persistent live operations; without them, the public page falls back to the bundled preview and admin mutations return a configuration error.

Run `npm test`, `npm run lint`, and `npm run build` before deploying.


Admin tournament updates include the `revision` returned by `/api/tournament`.
Stale edits receive HTTP 409; reload before submitting again. The legacy player
rename endpoint uses this same state and requires the same revision.
Set wins retain the existing array-length representation; live games and
completed-set game history are stored alongside them in the same match object. Admin corrections, including corrections after completion, invalidate
only the affected downstream branch. Repeating an identical result is safe.

The audit findings, verification commands, and remaining limitations are in
[AUDIT.md](AUDIT.md). Optional browser checks are in `scripts/audit-browser.mjs`;
Playwright is not added to the application dependencies.


## Live scoring

In Match management, choose **Start Match**. Both teams start at `0 [0]`,
meaning sets won followed by current-set games (never points). The +/− buttons
change a private draft. **Save Score** persists games without changing sets.
The saved value remains visible alongside drafts; failed saves leave it intact.

Save the final games, then use **Complete Set** and confirm. The server records
that set's games, increments the winning team's sets, and resets both games to
zero. **End Match** separately validates the full history and required set wins,
then saves the final result and bracket advancement together. Ordinary live
updates are rejected after completion. The existing **Save score / correction**
workflow remains available outside live matches and invalidates the affected
later rounds. Aggregate corrections intentionally replace detailed history;
legacy aggregate results cannot reconstruct historical games.

The active data source is `public.tournament_state.state` (JSONB), not the unused
normalized `matches`/`match_sets` tables. Optional match fields are `gamesA`,
`gamesB` (default zero), `setHistory` (default empty), and `scoreUpdatedAt`.
`setsA` and `setsB` remain arrays of set-win markers, preserving existing results.
No schema migration or data reset is required for these additive JSON fields.
Existing row-level security permits no browser writes. The authenticated PATCH
route validates every operation before the server-only service-role client writes.

The default format is best of three, with a game tiebreak at 6–6 in all sets:
valid finals are 6–0 through 6–4, 7–5, or 7–6, and reversed scores. A 7–6 result
records a played tiebreak; tiebreak points are outside this game's scoring model.
Operators can configure `scoringConfig` on the saved tournament JSON before play:

```json
{ "bestOf": 3, "tiebreak": true, "decidingSetTiebreak": true }
```

`bestOf` supports 3 or 5. Set `decidingSetTiebreak` to false for an advantage
last set, or `tiebreak` to false for earlier advantage sets. Advantage sets need
at least six games and exactly a two-game margin. Match-tiebreak replacement
sets are not supported. Games are integers from 0 to 100. Saving games never
automatically completes a set or match. Cancellation was not supported by the
existing system and is not introduced here.

Public pages poll the existing uncached `/api/tournament` every two seconds,
then refresh the server-rendered bracket on a newer persisted revision. This
includes the play-in. They show a connection warning on failures, retry, check
immediately on focus/reconnection, bound request duration, and cancel requests
and listeners on unmount. No browser database credentials or new service are
needed. Polling provides automatic updates with approximately two seconds of
latency plus request/render time. Each visitor currently reads the full small
bracket; evaluate a shared cache or streaming transport if traffic grows.

All edits use the existing tournament-wide `updated_at` revision in a conditional
SQL update. Exactly one concurrent writer succeeds. A stale or duplicate request
receives 409; the admin reloads persisted state and shows the conflict. Set numbers
add another duplicate-completion guard. A timed-out successful write is resolved
by the same conflict/reload path on retry. Live result and advancement are one
JSONB write, so failed persistence cannot advance the bracket partially.

## Live feature verification

- `npm test`: existing regressions, scoring rules, rendering, authenticated API,
  and real Supabase SDK requests to an isolated local PostgREST test double.
  The HTTP integration test requires permission to bind localhost.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- With Playwright installed externally, run:
  `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/live-browser.mjs`
  after building. Optionally set `PLAYWRIGHT_BROWSERS_PATH` to its browser cache.
  This starts a local production server on port 3198 with an isolated in-memory
  storage fixture, signs in through the real login form, and uses independent
  admin/public browser contexts. It tests repeated saves, failed writes, stale
  tabs, reconnect, sets, completion, advancement, reload, anonymous API rejection,
  and widths 320/768/1440. Artifacts default to `/private/tmp/tennis-live-tests`.
  The script shuts down all processes and discards its test records on exit.

The fixture exercises application persistence over HTTP, not a real PostgreSQL
server. A deployment smoke test against a dedicated Supabase test project is
still required to verify that environment's credentials and RLS configuration.


## Confirmed play-in participants

Team A is **Moguenia / Aech-Che**; Team B is **Yoabied / Ait-Idi**.
Ait-Idi retains the original `aait-idi` login/player ID. The bundled draw pins
these pairs while preserving all team IDs, all main-draw positions, the four
corner teams, and all 34 unique players. Displaced partners swap into the donor
roster slots instead of disappearing or being duplicated.

On loading an existing saved draw, the server reconciles these participants
using the same conditional revision update as scoring. It updates canonical
teams and their match copies together, without regenerating the bracket or
resetting any scores. If any affected match has started, has scores/history,
or has completed, its roster is preserved. A concurrent scoring write triggers
a reload and a fresh eligibility check before any roster update. Custom player
names, images, schedules and courts are preserved.

The browser test explicitly verifies these four participants and successive
play-in saves of `0 [1]`–`0 [0]`, `0 [2]`–`0 [1]`, and `0 [3]`–`0 [1]` against
both the persisted API response and the independent public browser session,
without reloading the public page. It then verifies reload persistence, valid
set completion and advancement into the main draw.
