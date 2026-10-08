# DRACARYS Platform

DRACARYS is a trading community prototype with email/password accounts, a public market feed, member community rooms, public trader records and performance dashboards. When Supabase is not configured, it shows clearly labelled fictional examples so the experience can be observed without a live account or database.

The app uses Next.js App Router and Supabase Auth/PostgreSQL. Supabase is the current identity/database adapter for this implementation. The domain model and billing boundary remain provider-neutral.

The approved transparent logo is in `public/dracarys-financial-group.png`; `public/dracarys-mark.png` is its cropped emblem for the header and compact brand placements.

The Feed supports text, image and document posts, replies and reactions. Community is one public group chat with a shared timeline for ordinary messages, structured signals and setups, image/file sharing, replies, reactions, message edits and soft deletion. Connected members receive updates through Supabase Realtime. Traders and Analytics show published setup and outcome records when connected; Analytics combines an activity trend, founder setup outcomes, anonymous community execution outcomes and a founder comparison. Founder and community outcome rates remain separate because they represent different records. Profile charts show the signed-in trader’s public executions or the member’s private execution journal. Daily, weekly, monthly and yearly views use dated records rather than estimates. Chronicle, Forge, War Room and Personal journal are marked Coming soon.

## Connect a database

1. Create a Supabase project and configure `.env.local` from `.env.example` with the project URL, publishable key and site URL. The publishable key is intended for the browser-facing client; never add a `service_role` key to this app.
2. Install the Supabase CLI using the official installation instructions, then run `supabase login` and `supabase link --project-ref <project-ref>` from this folder. The project reference is the identifier in the Supabase project URL. The CLI may ask for the database password; enter it only in the CLI prompt, never in this file.
3. For a brand-new database, run `supabase db push`. This applies the complete sequence in `supabase/migrations`, starting with the baseline copied from `docs/schema.sql`.
4. For a database that already received the schema or migrations manually in the SQL editor, do not run `db push` yet. First compare the remote objects with each local migration. Then use `supabase migration repair --status applied <version> ...` to record only the migrations that are already fully present. The versions are the 14-digit filename prefixes. Do not mark a migration applied if only part of its SQL ran; finish or correct that migration first. This prevents replaying `CREATE TYPE` and other non-idempotent baseline statements.
5. Run `supabase migration list` and confirm local and remote history match. Future database changes should be new ordered migration files and applied through the CLI, rather than entered only in the SQL editor.
6. In Supabase Auth, set the site URL and add the local and deployed `/auth/callback` URLs to the redirect allow list. Install the package dependencies from this folder with `pnpm install` (or `npm install`), then start the preview with `pnpm dev` (or `npm run dev`).

With no Supabase settings, the site runs in demo mode so its pages can be observed without a service account. Community examples, profile details, reactions and replies stay in the current browser; they are not sent to other members. The Founder Trader Demo can try community messages, signals, setups, replies, reactions and attachments with local-only data. Once Supabase is configured and all migrations are applied, every visitor can read the same public group timeline; signed-in members can send, reply, react and share attachments, with new messages and reactions delivered through Supabase Realtime. Reaction summaries expose counts and the viewer’s own reaction without exposing other members’ reaction records. A successful email/password registration creates a private account row and a separate public display profile through the database trigger. When email confirmation is enabled, the confirmation link returns through `/auth/callback` before opening the community.

In local demo mode, the sign-in and sign-up pages offer two preview roles. **Demo member** is read-only. **Founder Trader** can try community chat, signals, setups, replies, reactions and file attachments, plus the other preview tools; local changes stay in that browser and are not sent to other members or a database. A signed-out visitor can also try the community room in a clearly marked local preview. Neither role creates an account or places trades. Both sessions expire after four hours; use **Sign out** in the header to end a session.

Authenticated members can open **My profile** from the account name in the header. The profile editor updates the public display name, short bio, optional profile photo and performance sharing preference. Uploaded photos are stored in the `profile-avatars` bucket. Member executions remain private; group analytics only include anonymous daily totals when at least five opted-in members contributed that day. In the Founder Trader preview, profile changes and photo previews stay in browser storage.

## Security shape

- Supabase SSR stores refreshed sessions in HTTP-only cookies; the proxy only keeps the session current.
- Server actions verify the user before any write. Row-level security repeats ownership and access checks in PostgreSQL.
- Account email is kept in `members`/Supabase Auth. Public names come from `public_member_profiles`.
- Public aggregate reactions expose counts only. Individual reaction rows are member-scoped.
- No browser or server app code holds a service-role credential.

The Record route and premium areas remain in the broader staged plan in `docs/BUILD-PLAN.md`. The trader directory and Analytics are read-only public performance views. The Founder Trader demo does not create accounts, write to a database, send messages to real members or place trades.

## Database migration history

`supabase/migrations` is the source of truth for database changes. `20261003000000_base_schema.sql` is the initial schema baseline; the later files add authentication and community support, uploads, performance views, public group chat, cohort labels and the message-membership lookup grants needed by the chat row policies. `docs/schema.sql` remains a readable copy of the baseline. The connected project was checked against these migrations and its seven already-applied versions were recorded in the protected Supabase migration ledger; do not replay those schema files. Link the Supabase CLI and run `supabase migration list` before the next database change. From then on, add a new ordered migration and apply it through the CLI.

The project URL and browser publishable key are configured locally and are intentionally not committed. Production email delivery settings are also deployment-specific. Apply the migrations to the linked project to enable live accounts, photo uploads, aggregate performance data and community Realtime.
