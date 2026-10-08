# DRACARYS | Platform architecture

**Status:** foundation design, interactive preview and connected auth/community scaffold, 03 October 2026  
**Product rule:** every public claim about trading activity must be traceable to a record and its history. Demo records are visibly labelled and must never be mixed into live analytics.

## 1. Product boundaries

DRACARYS is a public trading journal and learning community. It does not promise returns, execute trades, or turn a published setup into a member's personal trade. The platform has one canonical trading record. The home feed, trader pages, Dragon's Record, Analytics, weekly reports and Chronicle read from that record.

The approved DRACARYS logo is supplied as a transparent PNG, with a cropped dragon-and-candles emblem for compact navigation. Founder names, live trades and payment-provider details have not been supplied, so the preview uses fictional profile personas and explicit demo examples until approved source material is available.

## 2. Proposed production architecture

Use a modular web application with a typed server boundary and PostgreSQL as the source of truth. Keep domain modules within one deployable application for the initial release; split services only when real load or team ownership requires it.

| Layer | Responsibility | Boundary |
|---|---|---|
| Web client | Responsive public pages, signed-in member views, accessible forms | Never decides a role or entitlement on its own |
| Application/API | Authentication checks, use cases, input validation, transactions, notification dispatch | Domain actions use a member identity resolved from the verified session |
| Identity | Sign-in, verification, recovery, session revocation | Local account identity maps to `members`; public profiles contain no credentials |
| PostgreSQL | Canonical content, setup lifecycle, memberships, access policy, audit history | Transactions enforce state transitions; row policies restrict private data |
| Object storage | Chart images, lesson media, attachments | Private by default; scoped, short-lived download URLs |
| Realtime delivery | Community room messages and new public activity | A delivery path only; persisted messages and activity remain in PostgreSQL |
| Background jobs | Notification fan-out, weekly digests, media checks, analytics refresh if needed | Idempotent jobs; never creates a trade result or weekly review automatically |
| Billing adapter | Provider-neutral subscription events and entitlement updates | `subscriptions` stores normalized state; provider integration remains replaceable |
| Operations | Logs, metrics, backups, moderation queue, incident trail | Exclude secrets, broker credentials and unnecessary personal data |

**Current implementation:** a TypeScript server-rendered web app using the Next.js App Router, Supabase SSR sessions, and Supabase PostgreSQL. Identity and database access are isolated under `platform/lib/supabase`; community actions remain server-side. Billing remains a provider-neutral domain boundary. The integration migration maps Supabase's verified `auth.uid()` into the schema's member identity helper and creates a separate public profile for feed display.

The original schema is PostgreSQL-first. The added adapter migration is the next ordered step after that base schema. Neither SQL file has been applied to a live project yet.

### Request path

1. The browser sends a session-authenticated request to an application action.
2. The server verifies the session, loads the member and current entitlement, and validates the requested operation.
3. A domain transaction writes the canonical row and its append-only event/revision.
4. The transaction commits before a job is enqueued for notifications.
5. Public pages and analytics read the committed record. Realtime only signals that a read model changed.

### Trust and security boundaries

- Derive `visitor`, `free_member`, `premium_member`, `founding_trader`, `financial_trader`, `admin`, and `super_admin` from server-controlled role/entitlement records. Never accept role claims from form data.
- Apply both server authorization and database row-level policies. Hide inaccessible screens in the UI, but treat that only as navigation, not security.
- Keep email, moderation notes, subscription identifiers, and private journals out of public profile queries.
- Charts and attachments use allow-listed file types, size limits, malware checks and expiring scoped URLs.
- Direct messages require both participants to be active members of the conversation. There is no routine moderator read path; a moderator can inspect a message only through an assigned open report, and that read is written to the append-only audit log.
- Rate-limit registration, messaging, reactions and reporting; support account export, deletion workflows and retention rules.
- Back up PostgreSQL, test restore procedures, encrypt traffic and storage, rotate keys, and record privileged access.
- Collect no broker passwords, account credentials or bank details.

## 3. Canonical data and history

`setups` is the stable identity of a published idea. Its initial thesis is inserted once. A correction creates a numbered `setup_revisions` row with a reason; it never overwrites old text. `setup_events` appends lifecycle transitions (published, triggered, active, closed, result recorded, review added). The latest valid event is the current projection. Revisions and events are append-only at the database boundary.

Personal execution is a different stream: `trader_execution_events` records whether the trader took or skipped the setup. `member_executions` is private to the member and never contributes to the trader's result. Published setup, trader execution and each member's execution remain independently inspectable.

Analytics are queries over canonical setups, revisions, lifecycle events and trader execution events. They must exclude preview/demo fixtures from production, state the denominator and date range, and link every count to its underlying record. A setup without an eligible result is not a win, loss or breakeven. No activity means “—”, not 0%.

The Chronicle is a date-based query over the same public records and weekly reports. It stores no duplicated setup copies. Weekly reports reference setup IDs and remain authored by the individual trader.

## 4. Service modules and key operations

- **Identity:** register, verify, sign in/out, recover account, change profile; private identity data is separated from public profile fields.
- **Community:** publish/edit own post, comment/reply, react, follow trader, report content, moderate; content edits retain moderation/audit metadata.
- **Record:** create draft, publish, append revision, advance allowed lifecycle, record trader execution, record result, add post-trade review. Published records cannot be silently deleted.
- **Analytics:** filter by trader, instrument, event date, state and result; produce counts and series from the same record tables; return the setup IDs behind each point.
- **Chronicle:** list year/month/week and open the original report, setup or review.
- **Forge:** browse courses, enforce premium entitlement, resume lesson, submit assignment, store progress.
- **War Room:** authorize private rooms, publish and moderate mentor discussions, notify subscribed participants.
- **Membership:** normalize trial/active/past_due/cancelled/expired state; process signed provider webhooks idempotently; separate payment event from access decision.
- **Admin:** scoped management and moderation tools; all high-impact actions produce an audit event.

## 5. Data lifecycle and analytics rules

- Store timestamps in UTC; render them in the member's selected timezone.
- Validate lifecycle edges on the server in a transaction. One setup may only have one terminal result. A correction is a new revision/event with actor, time and reason.
- Result taxonomy is `win`, `loss`, `breakeven`, `cancelled`, or `unresolved`; only closed, adjudicated outcomes enter win-rate denominators. Report both setup counts and personally taken counts separately.
- Instrument, trader, status, publication date and event date filters have stable definitions; a backdated correction never changes when the original was published.
- Analytics should disclose whether outcomes are counted per setup or per personally taken execution. Do not infer P&L or member outcomes from a setup result.
- Demo fixtures use `is_demo` and a dedicated preview environment. Production ingestion rejects demo rows.

## 6. Delivery and deployment

Maintain separate local, preview and production environments. Apply versioned SQL migrations, use least-privilege secrets, and require review for schema changes that touch immutable history. Use automated backup/restore and retention policies before inviting members. Add error monitoring and admin audit review. No real payments are enabled until a provider and webhook/signature policy are configured.

## 7. Current artifact scope

The responsive browser preview demonstrates the product map and local-only interactions. It opens with three labelled DEMO DATA setups, sample community and War Room messages, fictional trader personas, sample weekly reports, Forge lessons and journal notes. Editable setups, posts and room messages stay in browser storage; the remaining examples are read-only content. The app scaffold implements email/password accounts, confirmation callbacks, and a database-backed public feed. With no Supabase configuration it shows clearly labelled frontend demo fixtures on its observation routes; once configured, demo fixtures are hidden. Samples are never inserted into the database. Chat, moderation, trader record authoring, live analytics, premium access and the remaining phases are not implemented in the app yet.
