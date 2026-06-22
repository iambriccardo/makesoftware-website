# Make Software Website

Static Vite/React site for Make Software, plus a Supabase-backed Group Formation tool.

## Environment Variables

Keep the setup small. There are only two kinds of variables:

- Public browser config: safe to expose because Vite bundles it into the deployed JavaScript.
- Local/server secrets: never expose to the browser; use them only in Supabase Edge Function secrets or local shell commands.

Copy the example file when setting up locally:

```sh
cp .env.example .env
```

### Public Website Variables

These may be set in local `.env` and in the website host's build environment:

```sh
VITE_SUPABASE_URL=https://qzvntkplmraxyhdsuwce.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

`VITE_SUPABASE_URL` points the browser to the Supabase project.
`VITE_SUPABASE_PUBLISHABLE_KEY` lets the browser open a Supabase Realtime
WebSocket. This is public browser configuration, not a database secret. The page
still reads and writes participant data only through the group-formation-code-gated Edge
Function.

Do not put service-role keys, admin tokens, database URLs, or other secrets in `VITE_*` variables. Vite exposes all `VITE_*` values to anyone who can load the site.

### GitHub Pages Deployment Variables

The GitHub Pages workflow builds a static site, so Supabase browser config must
be available during the GitHub Actions build. Configure these as GitHub Actions
secrets under `Settings -> Secrets and variables -> Actions -> Secrets`.

Repository or `github-pages` environment secrets:

```sh
VITE_SUPABASE_URL=https://qzvntkplmraxyhdsuwce.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Do not add these to GitHub Pages:

```sh
GROUP_FORMATION_ADMIN_TOKEN
SUPABASE_DB_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SECRET_KEYS
```

Those are local-only or Supabase Edge Function server-side secrets. The deployed
website must not receive them.

On deploy, `.github/workflows/deploy.yml` reads those values from GitHub Actions
secrets, validates that they exist, runs `npm test`, builds with Vite, uploads
`dist`, and deploys to GitHub Pages.

### Supabase Edge Function Secrets

Supabase provides the database connection secrets used by the Edge Functions on the server side. The code reads:

```sh
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

On newer Supabase runtimes, `SUPABASE_SECRET_KEYS` can also provide the server-side secret key. These are server-side only and should not be configured in the frontend host.

The custom secret needed for the Group Formation admin endpoint is:

```sh
GROUP_FORMATION_ADMIN_TOKEN=use-a-long-random-value
```

For local stress testing, the public Group Formation endpoint also supports an
optional server-side switch:

```sh
GROUP_FORMATION_DISABLE_RATE_LIMITS=true
```

Leave this unset or set to `false` for normal use. When it is true, the Edge
Function skips only the one-new-participant-per-IP-per-hour limiter. Group formation codes,
browser participant ownership, formation state checks, and admin authentication still
run. Do not set this as a `VITE_*` variable; it belongs only in Supabase Edge
Function secrets.

Set the admin token in Supabase before using the admin script:

```sh
supabase secrets set GROUP_FORMATION_ADMIN_TOKEN="$(openssl rand -hex 32)" --project-ref qzvntkplmraxyhdsuwce
```

Temporarily disable the participant creation limiter for testing:

```sh
supabase secrets set GROUP_FORMATION_DISABLE_RATE_LIMITS=true --project-ref qzvntkplmraxyhdsuwce
```

Re-enable it after testing:

```sh
supabase secrets set GROUP_FORMATION_DISABLE_RATE_LIMITS=false --project-ref qzvntkplmraxyhdsuwce
```

Redeploy functions after changing function code:

```sh
supabase functions deploy group-formation --project-ref qzvntkplmraxyhdsuwce --use-api --no-verify-jwt
supabase functions deploy group-formation-admin --project-ref qzvntkplmraxyhdsuwce --use-api --no-verify-jwt
```

### Local-Only Operations Variables

These are for your own shell, not for the website deployment:

```sh
SUPABASE_DB_URL=postgresql://...
GROUP_FORMATION_ADMIN_TOKEN=...
```

`SUPABASE_DB_URL` is only needed to reapply the single migration file directly to the remote database while iterating:

```sh
npm run db:apply-remote
```

`GROUP_FORMATION_ADMIN_TOKEN` is also used by the local admin helper:

```sh
npm run group:admin -- status
npm run group:admin -- participants
npm run group:admin -- create --title "Make Software Group Formation" --size 3
npm run group:admin -- collect
npm run group:admin -- match
npm run group:admin -- close
npm run group:admin -- seed --count 18 --state collecting --size 3 --url http://127.0.0.1:5173
npm run group:admin -- seed --count 18 --state closed --size 3 --url http://127.0.0.1:5173
npm run group:admin -- clear-rate-limits
npm run group:admin -- delete-participants --ids id1,id2 --yes
npm run group:admin -- reset --yes
```

Use `npm run group:admin -- help` for the full command list. The helper reads `.env`
automatically, so local usage normally only requires `VITE_SUPABASE_URL` and
`GROUP_FORMATION_ADMIN_TOKEN`.

`create` and `status` print the four-character group formation code. Attendees
must enter that code on the Group Formation page before they can see the formation or
submit their profile.

Use `seed` when you want a UI playground immediately:

```sh
npm run group:admin -- seed --count 18 --state collecting --size 3 --url http://127.0.0.1:5173
npm run group:admin -- seed --count 18 --state closed --size 3 --url http://127.0.0.1:5173
```

`--state collecting` creates randomized participants and leaves the formation open,
so you can add/edit people manually and then run `match` while watching realtime
updates. `--state closed` runs the same matching path as `match`, closes the formation,
and prints the code plus an invite link. Seed still respects the single-formation
invariant, so reset first if another formation exists.

Pass `--url https://your-site.example` to `create` or `status` to also
print an invite link such as `/group-formation?code=ABCD`. The link pre-fills
the group formation code for attendees, but they still explicitly enter the formation.

Use `participants` to list participant IDs, then `delete-participants --ids ...`
to remove people from the current formation. This is useful after a closed
matching session when someone is no longer attending. Deleting a participant
removes their private key and group membership through database cascades; it does
not rerun matching or reshuffle existing groups.

Only one group formation can exist at a time. `create` intentionally fails until
the existing formation is reset/deleted, even if that formation is already
closed and only being kept around for export/review.

## Migration Workflow

During early testing, keep the schema in one file:

```sh
supabase/migrations/202606210001_group_formation.sql
```

This migration is intentionally reset-style for the Group Formation feature. It drops and recreates only the `group_formation*` tables, creates the `app_private` helper schema if needed, then reinstalls RLS, grants, and triggers.
The schema enforces the single-formation invariant with a single-row unique index on
`group_formations`; the admin Edge Function also checks this before inserting so
operators get a clear error.

Apply it directly to the remote database while iterating:

```sh
SUPABASE_DB_URL='postgresql://...' npm run db:apply-remote
```

This keeps the repo clean with one canonical migration file. It does not clean old entries from Supabase's remote migration history table if earlier experiments were already applied.

## Security Model

The deployed website does not contain secrets. Browser users can see the Supabase URL, so security cannot depend on hiding it.

The important controls are:

- Public joins and snapshots go through `group-formation`, an Edge Function.
- Admin actions go through `group-formation-admin`, protected by `GROUP_FORMATION_ADMIN_TOKEN`.
- Database writes use the server-side Supabase secret inside Edge Functions.
- Formation snapshots and participant writes require the current four-character group formation code.
- A browser token lets the same browser edit its own participant during `collecting`.
- The browser remembers the last active formation id, group formation code, and participant id per formation in localStorage. Server-side token checks still decide whether edits are allowed.
- New-participant creation is limited to one successful create per hashed IP per chapter per hour. Edits by the same browser token are not throttled. This limiter can be disabled temporarily for testing with the server-side `GROUP_FORMATION_DISABLE_RATE_LIMITS=true` Edge Function secret.
- The browser subscribes to a Supabase Realtime Broadcast channel after the group formation code has loaded a formation id. Broadcast payloads contain only change metadata, then the browser refreshes the code-gated Edge Function snapshot.
- A slower 30-second safety refresh remains active in case a browser tab sleeps or a Realtime connection reconnects.
- Closed result snapshots are served through the public Edge Function until admins reset/delete the formation.
- Token hashes and IP hashes are stored separately from public participant rows, with no public read grants.
- Rate-limit data is not publicly readable.

If a legitimate participant is blocked by the IP limit during a group formation, an admin
can clear the current chapter's rate-limit rows without deleting the formation:

```sh
npm run group:admin -- clear-rate-limits
```

Participant add/edit is open while the formation is `collecting`. Once matching
starts, writes are locked. After the formation is `closed`, an existing participant
can still view their result but cannot edit their profile; a browser that has not
joined that formation yet can submit once and will be assigned to the best existing
group without rerunning or reshuffling the original matching.

## Privacy and Group Exports

The Group Formation page shows a short privacy note in the UI. The practical model is:

- While a session is active, submitted participant details are visible to anyone who has the group formation code and can access the page.
- Participant details are stored and processed in Supabase, which provides the database and server-side Edge Functions for this feature.
- Admins should export the final groups, then delete submitted profile details from the database after the groups are created.
- Participants can use an alias or approximate recognizable name if they want stronger privacy.
- Accurate age, years of experience, and profession data improves matching quality because the algorithm uses those signals for diversity and knowledge sharing.
- Groups are suggested starting points for the group formation, not fixed assignments.

The browser export downloads a Markdown file from the data already visible on the page. It does not require extra environment variables or secret access.

## Checks

```sh
npm test
deno check supabase/functions/group-formation/index.ts supabase/functions/group-formation-admin/index.ts
npm run build
```
