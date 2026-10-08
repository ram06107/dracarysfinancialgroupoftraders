# DRACARYS | Build plan

This plan follows the requested order: map the whole system, establish the foundation, then ship coherent slices that use the same records.

## Phase 1 — Foundation (mapped; app scaffold prepared)

- Approve architecture, roles, route map, source-of-truth rules and PostgreSQL schema.
- Establish the visual system, responsive shell, Supabase cookie-session adapter, auth callback and initial database identity trigger.
- Add a Supabase integration migration that maps the schema's request identity to `auth.uid()` and separates public names from private account email.
- Define explicit table grants after row-level security; add environment-specific connection settings without committing credentials.
- Finish account recovery, email delivery settings, object storage, backup and restore procedures before launch.

**Current state:** source and SQL are prepared, but the migration has not been applied to a project and no real connection settings were supplied. The exit criteria are not yet met.

## Phase 2 — Community

- Profiles, public feed, threaded comments, reactions, follows, saved setups, rooms, message history, direct conversations, moderation and report queues.
- Add rate limits, content controls, notification preferences and realtime delivery over persisted records.

**Exit criteria:** free members can participate; visitor writes are blocked server-side; private messages are participant-only; moderator actions are traceable.

## Phase 3 — Dragon's Record

- Trader profile ownership, setup draft/publication, chart upload, immutable revision model, validated status machine, separate trader execution stream, member-private execution and post-trade review.
- Build the trader journal from the canonical setup/events query.

**Exit criteria:** every transition is recorded; losing and cancelled setups remain visible; correction requires reason and preserves prior wording; trader and member execution remain separate.

## Phase 4 — Analytics

- Add indexed filters, aggregate queries and accessible charts from canonical events; expose setup-level drill-down for every number.
- Publish methodology and denominator definitions; handle unresolved and demo data correctly.

**Exit criteria:** independent query reconciliation matches displayed totals; filters and timezone boundaries are consistent; zero eligible outcomes render as no rate.

## Phase 5 — Chronicle

- Date hierarchy, weekly review authoring for each trader and historic navigation over canonical setups/reports.

**Exit criteria:** archive links resolve to original records; a trader's missing weekly review is shown as missing rather than generated.

## Phase 6 — The Forge

- Course/module/lesson authoring, media and file security, lesson resume point, assignments, quizzes, progress and course completion.

**Exit criteria:** premium access is enforced server-side; progress saves reliably and resumes; course updates preserve attribution/version history.

## Phase 7 — The War Room

- Premium rooms, Q&A, feedback threads, announcements, live-session notices and staff moderation.

**Exit criteria:** expired entitlements lose access promptly; all room actions require current access; it supports mentorship rather than signal-only broadcasts.

## Phase 8 — Membership

- Select a payment provider after business/legal decisions; implement a replaceable adapter, signed idempotent webhook handling, renewal/cancellation/expiry and clear member status.

**Exit criteria:** provider failures cannot grant accidental premium access; cancellation and expiry are reflected; no card data is stored by DRACARYS.

## Phase 9 — Administration

- Scoped member, content, course, subscription and moderation administration; searchable audit history and emergency account controls.

**Exit criteria:** least privilege verified for every admin action; historical record corrections remain append-only; admin access is attributable.

## Phase 10 — Release readiness

- Independent security review, access-control review, mobile/accessibility review, data restore exercise, load and performance review, error handling, terms/privacy/risk text review and operational handover.

**Release gate:** no production release until real founders approve names/strategies, legal review confirms disclosures, production auth/storage/backups work, and the live analytics have been checked against source records. Performance claims and testimonials are never seeded.

## Current implementation state

The package includes the system map, a navigable local preview, and a connected-app scaffold for sign-up/sign-in plus database-backed community posts, comments and reactions. The scaffold preserves a genuine empty state until real records exist. Its database migration has not been applied, and the app has not been built or deployed. Next, connect a project, configure email confirmation and complete remaining community operations before moving to setup authoring.
