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

The public bracket and admin dashboard now read/write the same saved tournament state in Supabase. Run both SQL files in this order: `supabase/schema.sql`, then `supabase/seed_players_teams.sql`. The state row is initialized from the bundled draw the first time the server reads it; later changes persist in `public.tournament_state`.

From `/tournament-tennis-1337-admin`, an authorized admin can:

- Change any player's display name while keeping the original login/avatar filename.
- Set or change the date/time and court/place for every match, including the play-in.
- Record a best-of-three set result (2–0 or 2–1, for either team). The winner advances automatically, and the score/winner is shown on the public bracket.
- Correct or clear a score. Later-round slots are cleared and can be recorded again after the correction.

The public page remains the bracket page only. The service-role key is used only on the server and must never be exposed to browser code. A Supabase service-role key and the SQL migration are required for persistent live operations; without them, the public page falls back to the bundled preview and admin mutations return a configuration error.

Run `npm test`, `npm run lint`, and `npm run build` before deploying.
