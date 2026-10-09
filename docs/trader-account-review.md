# DRACARYS trader account review

DRACARYS uses one login with two account levels:

- **Public Member** is the default. Members can comment on feed posts and freely share messages, signals, setups and files in the public Community group chat.
- **DRACARYS Financial Trader** is an earned publishing role. Approved traders can publish to the feed and setup record. A public graduation-cap mark appears on their DRACARYS profile and beside their name in the community.

An application does not change the member's account. The application remains **Pending review** until an administrator approves it.

## Application and interview process

1. The applicant provides their account email, interview contact name, phone/WhatsApp, time zone, preferred interview availability, public trader name, markets, background, approach and a written process assessment.
2. Contact fields are private to the applicant and administrators. Account email comes from the signed-in Supabase identity; the applicant cannot replace it in the form. Do not collect ID documents, account statements or client details in this app.
3. The Administration Department completes private identity and background verification and records a written assessment score and pass/fail decision.
4. An administrator schedules a future appointment in East Africa Time and pastes a Zoom meeting URL created through DRACARYS' Zoom account. The appointment and department message appear on the applicant's private application page. The department can also use the saved email and phone to reach the applicant. This app does not create Zoom meetings or send emails/SMS automatically.
5. After the Zoom interview, the administrator marks it complete. Approval remains blocked until interview completion, identity and background checks, the accepted trader standards and a passing assessment score of at least 70 are all recorded.
6. Approval creates or updates the public trader profile and grants `financial_trader`. The profile badge is derived from the published trader profile, so applicants and declined applications never receive it.

Use the same assessment rubric for all applicants. Evaluate process and the quality of the public record, not a promise of future returns. Keep private reviewer notes out of public messages.

## Admin account and Supabase setup

Apply migrations in order after the existing platform migrations:

1. `20261008000100_financial_trader_role.sql`
2. `20261008000200_trader_application_review.sql`
3. `20261008000300_trader_interview_statuses.sql`
4. `20261008000400_verified_trader_workflow.sql`
5. `20261008000500_founder_verified_trader.sql`
6. `20261009000100_personal_journal_images.sql` (if not already applied)
7. `20261009000200_trader_application_admin_queue.sql`

The verified trader workflow migration grants `super_admin` to the requested email if it already has a row in `public.members`. The final queue migration repairs that grant if the earlier migration ran before the founder account existed and restores administrator SELECT access to the private application queue. If the account has not registered yet, create it through Supabase Auth first, then run `supabase/manual/initial_super_admin.sql` in the Supabase SQL editor. The script grants the admin role only; Supabase Auth must create the account and manage its password.

The admin panel is `/admin`. Server actions and Postgres functions both check the administrator role. Feed insert/update policies allow only founding traders, approved financial traders and administrators. Community chat remains available to all signed-in members, and comment permissions remain open to public members.

## Founder account

The registered founder account (`ramphilipgarang@gmail.com`) is granted the
`founding_trader` role and a published trader profile by
`20261008000500_founder_verified_trader.sql`. The founder does not need to file a
trader application; the application page recognizes the founding role and shows
the verified account state. This exception applies only to that account. All
other trader applications keep the verification, Zoom interview and assessment
requirements.
