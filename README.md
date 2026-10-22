# 1337 Tennis Tournament Platform

Production-oriented Next.js App Router tournament platform for a public doubles bracket and a protected admin dashboard at `/tournament-tennis-1337-admin`.

## Stack

- Next.js App Router + TypeScript strict mode
- Tailwind CSS
- shadcn/ui-compatible component primitives
- Lucide icons
- Supabase PostgreSQL + Auth
- Zod validation
- 42 API server-side integration with graceful fallback + cache hints

## Local setup

```bash
npm install
npm run dev
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FORTY_TWO_CLIENT_ID=
FORTY_TWO_CLIENT_SECRET=
FORTY_TWO_API_BASE_URL=https://api.intra.42.fr/v2
TOURNAMENT_TIMEZONE=Africa/Casablanca
ADMIN_ALLOWLIST=admin@example.com
```

## Database migration

Apply SQL migration in Supabase SQL editor:

- `supabase/migrations/20261022115000_init_tournament.sql`

This creates normalized tables for tournaments, players, teams, team_members, matches, match_sets, match_dependencies, administrators, and append-only audit_events, with constraints/indexes/triggers for team validity and draw consistency.

## Admin access model

- Real Supabase authentication is required.
- Server-side allowlist check uses `administrators` table (plus optional `ADMIN_ALLOWLIST` fallback).
- Privileged operations are protected with server-side authorization in route handlers.

## Import (`t.txt`) workflow

Importer endpoint supports preview and commit:

- `POST /api/admin/import-preview`
- `POST /api/admin/import-commit`

Validation includes empty/invalid rows, missing IDs, duplicates, duplicate membership, odd unmatched individuals, and pair-mode consistency.

### `t.txt` note

No `t.txt` file exists in this repository right now, so importer parsing is format-detection-based (supports `|`, `;`, `,`, tab, and whitespace tokenized rows).

## Draw and scoring

- Single-elimination doubles with next-power-of-two capacity and bye support.
- Four administrator-selected corners are pinned and excluded from random pool.
- Draw persistence and guarded reset (especially after played matches).
- Server-side score validation for best-of-three by default.
- Result submission updates winner and next-round slot and writes audit events.

## Testing

Focused tests cover core logic:

```bash
npm run test
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Deployment

- Deploy Next.js app on Vercel.
- Configure environment variables in Vercel project settings.
- Use Supabase project for Postgres/Auth and run the migration before first use.
