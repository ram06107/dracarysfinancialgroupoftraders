# DRACARYS | Roles, access and page map

## Role model

A user has one base membership role plus any explicitly granted staff capability. Premium is an entitlement attached to a membership period, not a self-selected profile field. Founding-trader ownership is bound to one trader profile. Admin permissions are capabilities, not a broad “staff can do everything” shortcut.

| Capability | Visitor | Free member | Premium member | Founding trader | Admin | Super admin |
|---|---:|---:|---:|---:|---:|---:|
| Read public pages, public analysis and published Dragon's Record | Yes | Yes | Yes | Yes | Yes | Yes |
| Register, manage own profile and preferences | — | Yes | Yes | Yes | Yes | Yes |
| Post, comment, react, follow, save public setups | — | Yes | Yes | Yes | Yes | Yes |
| Use public community room | Read | Yes | Yes | Yes | Yes | Yes |
| Private direct messages | — | Participant-only | Participant-only | Participant-only | Assigned open-report read, logged per message | Assigned open-report read, logged per message |
| Create/edit personal journal, private by default | — | Yes | Yes | Yes | No routine access | Break-glass, audited |
| Forge lessons and assignments | Catalogue preview | Enrolled premium | Yes | Yes | Manage content | Manage content |
| War Room rooms and mentor feedback | — | — | Yes | Yes | Moderation by capability | Moderation by capability |
| Create and publish trader analysis/setups/reviews | — | — | — | Own trader profile only | Assigned scope | Yes |
| Record trader execution for a setup | — | — | — | Own trader profile only | No | Audited correction only |
| Change another trader's public record | — | — | — | — | No | Append correction with reason; never erase history |
| Moderate community content and reports | — | Report only | Report only | Own content | Assigned queues | Yes |
| Manage members, entitlements and courses | — | — | — | No | Scoped capability | Yes |
| Manage roles, policy, system settings and audit | — | — | — | No | No | Yes |

**Enforcement:** each command checks the verified session, capability, row ownership, room membership and current entitlement on the server; database row-level policies repeat those constraints. Every privileged read/write and record correction is logged. A founding trader can review student work only for courses where an admin has assigned them as a mentor. Staff access to private journals is not a normal admin capability.

## Page map

| Route | Audience | Primary content / action | Canonical source |
|---|---|---|---|
| `/` | Everyone | Mission, recent public activity, five founder cards, community and academy entry points | Published posts, traders, setups, reports |
| `/community` | Everyone read; members write | Feed, filters, post composer, reactions, threaded comments, reports | Posts, comments, reactions |
| `/community/rooms/:slug` | Members / entitled members | Room history, live message stream, room rules | Rooms, memberships, messages |
| `/messages/:conversationId` | Conversation participants | Private conversation and message history | Conversations, participants, messages |
| `/traders` | Everyone | Five trader profiles and latest activity | Trader profiles, setups, reports |
| `/traders/:slug` | Everyone | Style, markets, public journal, setups, reviews, weekly reports | Trader profile plus canonical record |
| `/record` | Everyone | Filterable Dragon's Record and setup lifecycle | Setups, revisions, setup events, execution events |
| `/record/:setupId` | Everyone | Thesis, chart, timestamps, lifecycle, execution distinction and review | One canonical setup and event history |
| `/analytics` | Everyone | Date/trader/instrument filters, counts, charts with record drill-down | Derived queries over canonical record |
| `/chronicle` | Everyone | Year → month → week archive | Reports and dated canonical records |
| `/chronicle/:year/:week` | Everyone | Week's reports, analysis, setup outcomes and reviews | Original records, not copies |
| `/forge` | Catalogue public; lessons premium | Course list, modules and lesson resume points | Courses, modules, lessons, progress |
| `/forge/courses/:slug/:lesson` | Premium | Lesson materials, quiz/assignment, saved progress | Lesson and member progress |
| `/war-room` | Premium | Private rooms, mentor Q&A, announcements, student analysis | Premium rooms and messages |
| `/account` | Signed-in members | Profile, followed traders, saved setups, notifications, subscription | Member profile, preferences, membership |
| `/journal` | Signed-in members | Private personal trading journal | Member-owned journal entries |
| `/admin` | Admin capability | Moderation, member/content/curriculum management, audit search | Admin-scoped entities and audit log |

Navigation is permission-aware: free members can see a concise Forge/WAR Room preview with the access reason, while premium-only lesson and room routes enforce entitlement on every request. Visitors are offered registration when they attempt a member action. Do not make a locked control look active.

## Implemented app routes in this slice

`platform/app/` ships `/`, `/about`, `/community`, `/traders`, `/record`, `/analytics`, `/chronicle`, `/forge`, `/war-room`, `/journal`, `/sign-in`, `/sign-up`, and the email confirmation callback at `/auth/callback`. The community route reads shared `posts`, `comments`, `post_reactions`, and `public_member_profiles` when configured; authenticated members can create posts, reply and toggle reactions. With no Supabase settings, the public routes show frontend-only, clearly labelled demo fixtures for observation. These examples are not database rows and do not support real trading activity, premium access, or private member journaling. Routes still planned include rooms, direct messages, account dashboards, record authoring, moderation and administration.

## Primary journeys

1. **Visitor to member:** home → founder profile → published setup → analytics drill-down → community registration → first post/follow.
2. **Observe a setup:** record list → setup detail → lifecycle timeline → trader execution distinction → review → corresponding analytics/Chronicle entry.
3. **Learn:** Forge catalogue → course → resume lesson → assignment → progress → optional War Room discussion.
4. **Trader publishing:** draft thesis → publish immutable original → append trigger/activation/close events → record result → add review → same record updates home, profile, analytics, weekly report and Chronicle.
5. **Moderation:** member report → assigned queue → scoped decision → reasoned action → member notification and audit entry.
