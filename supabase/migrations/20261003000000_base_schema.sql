-- DRACARYS PostgreSQL schema, initial reference migration.
-- Apply with a migration runner in a new database. UUID subjects are issued by the
-- configured identity adapter. Never connect a browser directly with owner credentials.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE staff_role AS ENUM ('founding_trader', 'admin', 'super_admin');
CREATE TYPE membership_state AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE access_tier AS ENUM ('public', 'premium');
CREATE TYPE setup_direction AS ENUM ('long', 'short');
CREATE TYPE setup_event_type AS ENUM (
  'published', 'triggered', 'not_triggered', 'active', 'closed',
  'result_recorded', 'result_corrected'
);
CREATE TYPE setup_result AS ENUM ('win', 'loss', 'breakeven', 'cancelled', 'unresolved');
CREATE TYPE trader_execution_state AS ENUM ('taken', 'skipped', 'partial', 'corrected');
CREATE TYPE room_kind AS ENUM ('public', 'premium', 'direct');
CREATE TYPE notification_kind AS ENUM (
  'analysis', 'setup', 'setup_triggered', 'setup_closed', 'post', 'comment',
  'message', 'course', 'lesson', 'weekly_report', 'mentor_announcement', 'subscription'
);

CREATE TABLE members (
  id uuid PRIMARY KEY,
  email_private text NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 80),
  avatar_key text,
  timezone text NOT NULL DEFAULT 'UTC',
  profile_bio text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE members IS 'Private member identity/profile row; never use as a public profile query.';

CREATE TABLE staff_grants (
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  role staff_role NOT NULL,
  granted_by uuid REFERENCES members(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  reason text NOT NULL,
  PRIMARY KEY (member_id, role, granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE INDEX staff_grants_active_idx ON staff_grants (member_id, role) WHERE revoked_at IS NULL;

CREATE TABLE trader_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES members(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  public_name text NOT NULL CHECK (length(trim(public_name)) BETWEEN 1 AND 100),
  trading_style text NOT NULL DEFAULT '',
  experience_summary text NOT NULL DEFAULT '',
  markets text[] NOT NULL DEFAULT '{}',
  profile_image_key text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE CHECK (symbol = upper(symbol)),
  display_name text NOT NULL,
  asset_class text NOT NULL DEFAULT 'forex',
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 12000),
  attachment_key text,
  visibility access_tier NOT NULL DEFAULT 'public',
  edited_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_feed_idx ON posts (created_at DESC) WHERE removed_at IS NULL;
CREATE INDEX posts_author_idx ON posts (author_id, created_at DESC);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE RESTRICT,
  parent_comment_id uuid REFERENCES comments(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 6000),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_thread_idx ON comments (post_id, created_at);

CREATE TABLE post_reactions (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  reaction text NOT NULL CHECK (reaction IN ('like', 'insightful', 'question')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id, reaction)
);

CREATE TABLE trader_follows (
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  trader_profile_id uuid NOT NULL REFERENCES trader_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, trader_profile_id)
);

CREATE TABLE saved_setups (
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  setup_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, setup_id)
);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  room_type room_kind NOT NULL DEFAULT 'public' CHECK (room_type <> 'direct'),
  access access_tier NOT NULL DEFAULT 'public',
  created_by uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE room_members (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (room_id, member_id)
);
CREATE INDEX room_members_member_idx ON room_members (member_id, room_id) WHERE left_at IS NULL;

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE TABLE conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (conversation_id, member_id)
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE RESTRICT,
  conversation_id uuid REFERENCES conversations(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 8000),
  attachment_key text,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(room_id, conversation_id) = 1)
);
CREATE INDEX room_messages_idx ON messages (room_id, created_at DESC) WHERE room_id IS NOT NULL;
CREATE INDEX conversation_messages_idx ON messages (conversation_id, created_at DESC) WHERE conversation_id IS NOT NULL;

-- A setup row is a stable published identity. All editable thesis content lives in
-- append-only revisions. Current state/result are projections over append-only events.
CREATE TABLE setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_profile_id uuid NOT NULL REFERENCES trader_profiles(id) ON DELETE RESTRICT,
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  direction setup_direction NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX setups_trader_published_idx ON setups (trader_profile_id, published_at DESC);
CREATE INDEX setups_instrument_published_idx ON setups (instrument_id, published_at DESC);
CREATE INDEX setups_live_published_idx ON setups (published_at DESC) WHERE is_demo = false;

ALTER TABLE saved_setups
  ADD CONSTRAINT saved_setups_setup_fk FOREIGN KEY (setup_id) REFERENCES setups(id) ON DELETE RESTRICT;

CREATE TABLE setup_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id uuid NOT NULL REFERENCES setups(id) ON DELETE RESTRICT,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  entry_low numeric(20, 8),
  entry_high numeric(20, 8),
  stop_price numeric(20, 8),
  target_price numeric(20, 8),
  market_context text NOT NULL DEFAULT '',
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 1 AND 12000),
  chart_object_key text,
  correction_reason text,
  created_by uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setup_id, revision_no),
  CHECK (entry_low IS NULL OR entry_high IS NULL OR entry_low <= entry_high),
  CHECK (revision_no = 1 OR length(trim(coalesce(correction_reason, ''))) > 0)
);
CREATE INDEX setup_revisions_latest_idx ON setup_revisions (setup_id, revision_no DESC);

CREATE TABLE setup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id uuid NOT NULL REFERENCES setups(id) ON DELETE RESTRICT,
  event_no integer NOT NULL CHECK (event_no > 0),
  event_type setup_event_type NOT NULL,
  result setup_result,
  note text NOT NULL DEFAULT '',
  actor_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setup_id, event_no),
  CHECK (
    (event_type IN ('result_recorded', 'result_corrected') AND result IS NOT NULL)
    OR (event_type NOT IN ('result_recorded', 'result_corrected') AND result IS NULL)
  ),
  CHECK (event_type <> 'result_corrected' OR length(trim(note)) > 0)
);
CREATE INDEX setup_events_timeline_idx ON setup_events (setup_id, event_no);
CREATE INDEX setup_events_kind_date_idx ON setup_events (event_type, created_at DESC);

-- Serialize each setup's event stream and enforce the lifecycle at the database
-- boundary as well as in the application service.
CREATE FUNCTION validate_setup_event_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  last_no integer;
  previous_state setup_event_type;
  previous_result setup_result;
BEGIN
  PERFORM 1 FROM setups WHERE id = NEW.setup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'setup does not exist';
  END IF;

  SELECT coalesce(max(event_no), 0) INTO last_no
  FROM setup_events WHERE setup_id = NEW.setup_id;
  IF NEW.event_no <> last_no + 1 THEN
    RAISE EXCEPTION 'event_no must append to the setup history';
  END IF;

  SELECT event_type INTO previous_state
  FROM setup_events
  WHERE setup_id = NEW.setup_id
    AND event_type IN ('published', 'triggered', 'not_triggered', 'active', 'closed')
  ORDER BY event_no DESC LIMIT 1;
  SELECT result INTO previous_result
  FROM setup_events
  WHERE setup_id = NEW.setup_id
    AND event_type IN ('result_recorded', 'result_corrected')
  ORDER BY event_no DESC LIMIT 1;

  IF last_no = 0 THEN
    IF NEW.event_type <> 'published' OR NEW.event_no <> 1 THEN
      RAISE EXCEPTION 'the first setup event must be publication';
    END IF;
  ELSIF NEW.event_type = 'published' THEN
    RAISE EXCEPTION 'a published setup cannot be republished';
  ELSIF NEW.event_type IN ('triggered', 'not_triggered') AND previous_state <> 'published' THEN
    RAISE EXCEPTION 'trigger status must follow publication';
  ELSIF NEW.event_type = 'active' AND previous_state <> 'triggered' THEN
    RAISE EXCEPTION 'activation must follow a trigger';
  ELSIF NEW.event_type = 'closed' AND previous_state NOT IN ('active', 'not_triggered') THEN
    RAISE EXCEPTION 'closure must follow an active or not-triggered setup';
  ELSIF NEW.event_type = 'result_recorded' AND (previous_state <> 'closed' OR previous_result IS NOT NULL) THEN
    RAISE EXCEPTION 'record one result after closure; use a correction to amend it';
  ELSIF NEW.event_type = 'result_corrected' AND (previous_state <> 'closed' OR previous_result IS NULL) THEN
    RAISE EXCEPTION 'a result correction requires a closed setup with a recorded result';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER setup_event_lifecycle_guard BEFORE INSERT ON setup_events
  FOR EACH ROW EXECUTE FUNCTION validate_setup_event_insert();

CREATE FUNCTION validate_setup_revision_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  last_revision integer;
BEGIN
  PERFORM 1 FROM setups WHERE id = NEW.setup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'setup does not exist';
  END IF;
  SELECT coalesce(max(revision_no), 0) INTO last_revision
  FROM setup_revisions WHERE setup_id = NEW.setup_id;
  IF NEW.revision_no <> last_revision + 1 THEN
    RAISE EXCEPTION 'revision_no must append to the setup history';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER setup_revision_sequence_guard BEFORE INSERT ON setup_revisions
  FOR EACH ROW EXECUTE FUNCTION validate_setup_revision_insert();

CREATE TABLE trader_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id uuid NOT NULL REFERENCES setups(id) ON DELETE RESTRICT,
  trader_profile_id uuid NOT NULL REFERENCES trader_profiles(id) ON DELETE RESTRICT,
  event_no integer NOT NULL CHECK (event_no > 0),
  state trader_execution_state NOT NULL,
  note text NOT NULL DEFAULT '',
  correction_reason text,
  actor_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setup_id, event_no),
  CHECK (state <> 'corrected' OR length(trim(coalesce(correction_reason, ''))) > 0)
);
CREATE INDEX trader_execution_latest_idx ON trader_execution_events (setup_id, event_no DESC);

CREATE TABLE setup_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id uuid NOT NULL REFERENCES setups(id) ON DELETE RESTRICT,
  trader_profile_id uuid NOT NULL REFERENCES trader_profiles(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 12000),
  created_by uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX setup_reviews_record_idx ON setup_reviews (setup_id, created_at);

-- Member execution is private and is deliberately excluded from trader performance views.
CREATE TABLE member_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  setup_id uuid REFERENCES setups(id) ON DELETE RESTRICT,
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  direction setup_direction NOT NULL,
  entry_price numeric(20, 8),
  exit_price numeric(20, 8),
  risk_amount numeric(20, 8),
  result setup_result,
  notes text NOT NULL DEFAULT '',
  traded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_executions_owner_date_idx ON member_executions (member_id, traded_at DESC);

CREATE TABLE weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_profile_id uuid NOT NULL REFERENCES trader_profiles(id) ON DELETE RESTRICT,
  week_start date NOT NULL,
  market_review text NOT NULL,
  lessons text NOT NULL DEFAULT '',
  next_week_view text NOT NULL DEFAULT '',
  authored_by uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  UNIQUE (trader_profile_id, week_start)
);
CREATE INDEX weekly_reports_archive_idx ON weekly_reports (week_start DESC);
CREATE TABLE weekly_report_setups (
  weekly_report_id uuid NOT NULL REFERENCES weekly_reports(id) ON DELETE RESTRICT,
  setup_id uuid NOT NULL REFERENCES setups(id) ON DELETE RESTRICT,
  mention_kind text NOT NULL CHECK (mention_kind IN ('published', 'successful', 'failed', 'missed', 'lesson')),
  PRIMARY KEY (weekly_report_id, setup_id, mention_kind)
);

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  access access_tier NOT NULL DEFAULT 'premium',
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE course_mentors (
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  granted_by uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  reason text NOT NULL,
  PRIMARY KEY (course_id, member_id, granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE INDEX course_mentors_active_idx ON course_mentors (member_id, course_id) WHERE revoked_at IS NULL;
CREATE TABLE course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  title text NOT NULL,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, sort_order)
);
CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES course_modules(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body_markdown text NOT NULL DEFAULT '',
  media_object_key text,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, sort_order)
);
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  prompt text NOT NULL,
  rubric text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  response text NOT NULL,
  mentor_feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES members(id) ON DELETE RESTRICT,
  reviewed_at timestamptz
);
CREATE INDEX assignment_submissions_member_idx ON assignment_submissions (member_id, submitted_at DESC);
CREATE TABLE lesson_progress (
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  position_seconds integer NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, lesson_id)
);

-- Provider-neutral membership state. Provider identifiers are opaque references only;
-- no payment card data belongs here. Webhook idempotency is tracked separately.
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  state membership_state NOT NULL DEFAULT 'pending',
  provider_key text,
  provider_subscription_ref text,
  period_start timestamptz,
  period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);
CREATE INDEX subscriptions_member_state_idx ON subscriptions (member_id, state, period_end DESC);
CREATE UNIQUE INDEX subscriptions_provider_ref_idx ON subscriptions (provider_key, provider_subscription_ref)
  WHERE provider_key IS NOT NULL AND provider_subscription_ref IS NOT NULL;
CREATE TABLE billing_webhook_receipts (
  provider_key text NOT NULL,
  event_ref text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  outcome text,
  PRIMARY KEY (provider_key, event_ref)
);

CREATE TABLE notification_preferences (
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  kind notification_kind NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, kind)
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  kind notification_kind NOT NULL,
  subject text NOT NULL,
  target_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_inbox_idx ON notifications (member_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE personal_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  instrument_id uuid REFERENCES instruments(id) ON DELETE RESTRICT,
  analysis text NOT NULL DEFAULT '',
  risk_notes text NOT NULL DEFAULT '',
  result_notes text NOT NULL DEFAULT '',
  psychology_notes text NOT NULL DEFAULT '',
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personal_journal_owner_idx ON personal_journal_entries (member_id, created_at DESC);

CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  target_kind text NOT NULL CHECK (target_kind IN ('post', 'comment', 'message', 'profile')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  assigned_to uuid REFERENCES members(id) ON DELETE RESTRICT,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX content_reports_queue_idx ON content_reports (status, created_at) WHERE status IN ('open', 'reviewing');

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES members(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  reason text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_actor_idx ON audit_log (actor_id, created_at DESC);

-- Views expose projections while keeping source rows normalized and immutable.
CREATE VIEW setup_record_current AS
SELECT s.id AS setup_id, s.trader_profile_id, s.instrument_id, i.symbol, s.direction,
       s.published_at, s.is_demo,
       rev.revision_no, rev.entry_low, rev.entry_high, rev.stop_price, rev.target_price,
       rev.market_context, rev.rationale, rev.chart_object_key,
       state.event_type AS current_state, state.created_at AS state_changed_at,
       outcome.result AS current_result, outcome.created_at AS result_recorded_at
FROM setups s
JOIN instruments i ON i.id = s.instrument_id
JOIN LATERAL (
  SELECT r.* FROM setup_revisions r WHERE r.setup_id = s.id
  ORDER BY r.revision_no DESC LIMIT 1
) rev ON true
LEFT JOIN LATERAL (
  SELECT e.event_type, e.created_at FROM setup_events e
  WHERE e.setup_id = s.id
    AND e.event_type IN ('published', 'triggered', 'not_triggered', 'active', 'closed')
  ORDER BY e.event_no DESC LIMIT 1
) state ON true
LEFT JOIN LATERAL (
  SELECT e.result, e.created_at FROM setup_events e
  WHERE e.setup_id = s.id AND e.event_type IN ('result_recorded', 'result_corrected')
  ORDER BY e.event_no DESC LIMIT 1
) outcome ON true;

CREATE VIEW live_setup_record AS
SELECT * FROM setup_record_current WHERE is_demo = false;

CREATE VIEW setup_trader_execution_current AS
SELECT DISTINCT ON (e.setup_id)
  e.setup_id, e.trader_profile_id, e.state AS execution_state, e.note, e.created_at
FROM trader_execution_events e
ORDER BY e.setup_id, e.event_no DESC;

CREATE VIEW chronicle_setup_entries AS
SELECT s.published_at::date AS entry_date, s.trader_profile_id, s.id AS setup_id,
       'setup'::text AS entry_type, s.is_demo
FROM setups s
WHERE s.is_demo = false;

-- Each setup is created in one transaction: insert setup, revision 1 and event 1
-- (published). The application locks the setup row while assigning event/revision
-- numbers and checking lifecycle transitions.
-- Revision/event rows must be append-only. These triggers also protect against
-- accidental mutation by an over-privileged application bug.
CREATE FUNCTION deny_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'history is append-only: create a correction event instead';
END;
$$;
CREATE TRIGGER setup_revisions_immutable BEFORE UPDATE OR DELETE ON setup_revisions
  FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER setup_events_immutable BEFORE UPDATE OR DELETE ON setup_events
  FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER trader_execution_events_immutable BEFORE UPDATE OR DELETE ON trader_execution_events
  FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER setup_reviews_immutable BEFORE UPDATE OR DELETE ON setup_reviews
  FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();

-- Stable setup identity cannot be rewritten or removed after publication.
CREATE TRIGGER setups_immutable BEFORE UPDATE OR DELETE ON setups
  FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();

-- JWT sub is injected only by the trusted authenticated database gateway.
-- If using a different identity adapter, replace this function and policy context.
CREATE FUNCTION request_member_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE FUNCTION protect_assignment_submission() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.response IS DISTINCT FROM OLD.response
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'submitted work is preserved; mentors may append feedback only';
  END IF;
  IF NEW.reviewed_by IS DISTINCT FROM request_member_id() THEN
    RAISE EXCEPTION 'review attribution must match the authenticated reviewer';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER assignment_submission_response_immutable BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION protect_assignment_submission();

-- Member-private data. Public setup and community reads are handled by public
-- application queries; private rows are constrained again here.
ALTER TABLE member_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_exec_owner_select ON member_executions FOR SELECT
  USING (member_id = request_member_id());
CREATE POLICY member_exec_owner_insert ON member_executions FOR INSERT
  WITH CHECK (member_id = request_member_id());
CREATE POLICY member_exec_owner_update ON member_executions FOR UPDATE
  USING (member_id = request_member_id()) WITH CHECK (member_id = request_member_id());

ALTER TABLE personal_journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_owner_select ON personal_journal_entries FOR SELECT
  USING (member_id = request_member_id());
CREATE POLICY journal_owner_insert ON personal_journal_entries FOR INSERT
  WITH CHECK (member_id = request_member_id());
CREATE POLICY journal_owner_update ON personal_journal_entries FOR UPDATE
  USING (member_id = request_member_id()) WITH CHECK (member_id = request_member_id());

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY progress_owner_select ON lesson_progress FOR SELECT
  USING (member_id = request_member_id());
CREATE POLICY progress_owner_insert ON lesson_progress FOR INSERT
  WITH CHECK (member_id = request_member_id());
CREATE POLICY progress_owner_update ON lesson_progress FOR UPDATE
  USING (member_id = request_member_id()) WITH CHECK (member_id = request_member_id());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_owner_select ON notifications FOR SELECT
  USING (member_id = request_member_id());
CREATE POLICY notification_owner_update ON notifications FOR UPDATE
  USING (member_id = request_member_id()) WITH CHECK (member_id = request_member_id());

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_owner_all ON notification_preferences FOR ALL
  USING (member_id = request_member_id()) WITH CHECK (member_id = request_member_id());

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_owner_select ON subscriptions FOR SELECT
  USING (member_id = request_member_id());

-- Authorization helpers run with a fixed, owner-controlled search path and return
-- only booleans. The authenticated gateway supplies the verified JWT subject.
CREATE FUNCTION request_has_staff_role(required_role staff_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_grants g
    WHERE g.member_id = request_member_id() AND g.role = required_role AND g.revoked_at IS NULL
  )
$$;
CREATE FUNCTION request_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT request_has_staff_role('admin') OR request_has_staff_role('super_admin')
$$;
CREATE FUNCTION request_is_premium() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.member_id = request_member_id() AND s.state = 'active'
      AND (s.period_end IS NULL OR s.period_end > now())
  )
$$;
CREATE FUNCTION request_owns_trader(profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM trader_profiles t
    JOIN staff_grants g ON g.member_id = t.member_id
    WHERE t.id = profile_id AND t.member_id = request_member_id()
      AND g.role = 'founding_trader' AND g.revoked_at IS NULL
  )
$$;
CREATE FUNCTION request_can_access_course(course_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses c WHERE c.id = course_uuid AND c.published_at IS NOT NULL
      AND (c.access = 'public' OR request_is_premium() OR request_is_admin())
  )
$$;
CREATE FUNCTION request_is_course_mentor(course_uuid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM course_mentors cm
    WHERE cm.course_id = course_uuid AND cm.member_id = request_member_id()
      AND cm.revoked_at IS NULL
  )
$$;

-- Public identity and member-owned profile rows.
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read_self_or_admin ON members FOR SELECT
  USING (id = request_member_id() OR request_is_admin());
CREATE POLICY members_update_self_or_admin ON members FOR UPDATE
  USING (id = request_member_id() OR request_is_admin())
  WITH CHECK (id = request_member_id() OR request_is_admin());

ALTER TABLE staff_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_grants_read_self_or_admin ON staff_grants FOR SELECT
  USING (member_id = request_member_id() OR request_is_admin());

ALTER TABLE trader_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY trader_profile_public_read ON trader_profiles FOR SELECT
  USING (is_published OR member_id = request_member_id() OR request_is_admin());
CREATE POLICY trader_profile_owner_update ON trader_profiles FOR UPDATE
  USING (member_id = request_member_id() AND request_has_staff_role('founding_trader'))
  WITH CHECK (member_id = request_member_id() AND request_has_staff_role('founding_trader'));

-- Public free community. Premium-only posts remain visible to their author and
-- current premium members. Editing/removal is attributable in audit_log.
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_read_accessible ON posts FOR SELECT
  USING (removed_at IS NULL AND (visibility = 'public' OR request_is_premium())
    OR author_id = request_member_id() OR request_is_admin());
CREATE POLICY posts_member_insert ON posts FOR INSERT
  WITH CHECK (author_id = request_member_id()
    AND (visibility = 'public' OR request_is_premium()));
CREATE POLICY posts_author_or_admin_update ON posts FOR UPDATE
  USING (author_id = request_member_id() OR request_is_admin())
  WITH CHECK (author_id = request_member_id() OR request_is_admin());

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_read_accessible ON comments FOR SELECT
  USING ((removed_at IS NULL AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id))
    OR author_id = request_member_id() OR request_is_admin());
CREATE POLICY comments_member_insert ON comments FOR INSERT
  WITH CHECK (author_id = request_member_id() AND EXISTS (
    SELECT 1 FROM posts p WHERE p.id = post_id
  ));
CREATE POLICY comments_author_or_admin_update ON comments FOR UPDATE
  USING (author_id = request_member_id() OR request_is_admin())
  WITH CHECK (author_id = request_member_id() OR request_is_admin());

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY reactions_read_own ON post_reactions FOR SELECT USING (member_id = request_member_id());
CREATE POLICY reactions_owner_insert ON post_reactions FOR INSERT
  WITH CHECK (member_id = request_member_id() AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id));
CREATE POLICY reactions_owner_delete ON post_reactions FOR DELETE
  USING (member_id = request_member_id());

ALTER TABLE trader_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_owner_read ON trader_follows FOR SELECT USING (member_id = request_member_id());
CREATE POLICY follows_owner_insert ON trader_follows FOR INSERT
  WITH CHECK (member_id = request_member_id());
CREATE POLICY follows_owner_delete ON trader_follows FOR DELETE
  USING (member_id = request_member_id());

ALTER TABLE saved_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_setups_owner_all ON saved_setups FOR ALL
  USING (member_id = request_member_id()) WITH CHECK (member_id = request_member_id());

-- Public rooms may be read by members. Premium room entry requires a current
-- entitlement. Direct messages are participant-only at both conversation and row level.
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_read_accessible ON rooms FOR SELECT
  USING (archived_at IS NULL AND (access = 'public' OR request_is_premium())
    OR request_is_admin());
CREATE POLICY rooms_admin_insert ON rooms FOR INSERT
  WITH CHECK (created_by = request_member_id() AND request_is_admin());
CREATE POLICY rooms_admin_update ON rooms FOR UPDATE
  USING (request_is_admin()) WITH CHECK (request_is_admin());

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY room_members_read_self_or_admin ON room_members FOR SELECT
  USING (member_id = request_member_id() OR request_is_admin());
CREATE POLICY room_members_join_self ON room_members FOR INSERT
  WITH CHECK (member_id = request_member_id() AND EXISTS (
    SELECT 1 FROM rooms r WHERE r.id = room_id AND r.archived_at IS NULL
      AND (r.access = 'public' OR request_is_premium())
  ));
CREATE POLICY room_members_leave_self ON room_members FOR UPDATE
  USING (member_id = request_member_id()) WITH CHECK (member_id = request_member_id() AND EXISTS (
    SELECT 1 FROM rooms r WHERE r.id = room_id AND r.archived_at IS NULL
      AND (r.access = 'public' OR request_is_premium())
  ));

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_participant_read ON conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = id AND cm.member_id = request_member_id() AND cm.left_at IS NULL));
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_members_participant_read ON conversation_members FOR SELECT
  USING (member_id = request_member_id() OR request_is_admin());

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_participant_read ON messages FOR SELECT
  USING (
    (room_id IS NOT NULL AND removed_at IS NULL AND EXISTS (
      SELECT 1 FROM room_members rm WHERE rm.room_id = messages.room_id
        AND rm.member_id = request_member_id() AND rm.left_at IS NULL
    ))
    OR (conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = messages.conversation_id
        AND cm.member_id = request_member_id() AND cm.left_at IS NULL
    ))
    OR author_id = request_member_id()
  );
CREATE POLICY messages_participant_insert ON messages FOR INSERT
  WITH CHECK (author_id = request_member_id() AND (
    (room_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM room_members rm WHERE rm.room_id = messages.room_id
        AND rm.member_id = request_member_id() AND rm.left_at IS NULL
    ))
    OR (conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = messages.conversation_id
        AND cm.member_id = request_member_id() AND cm.left_at IS NULL
    ))
  ));
-- Published setup history is publicly readable, while writes belong to the
-- assigned founding trader or a super admin. History mutation triggers stay active.
ALTER TABLE setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY setups_public_read ON setups FOR SELECT USING (is_demo = false);
CREATE POLICY setups_trader_insert ON setups FOR INSERT
  WITH CHECK (is_demo = false AND request_owns_trader(trader_profile_id));
ALTER TABLE setup_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY setup_revisions_public_read ON setup_revisions FOR SELECT
  USING (EXISTS (SELECT 1 FROM setups s WHERE s.id = setup_id AND s.is_demo = false));
CREATE POLICY setup_revisions_author_insert ON setup_revisions FOR INSERT
  WITH CHECK ((created_by = request_member_id() OR request_has_staff_role('super_admin'))
    AND EXISTS (SELECT 1 FROM setups s WHERE s.id = setup_id
      AND (request_owns_trader(s.trader_profile_id) OR request_has_staff_role('super_admin'))));
ALTER TABLE setup_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY setup_events_public_read ON setup_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM setups s WHERE s.id = setup_id AND s.is_demo = false));
CREATE POLICY setup_events_author_insert ON setup_events FOR INSERT
  WITH CHECK ((actor_id = request_member_id() OR request_has_staff_role('super_admin'))
    AND EXISTS (SELECT 1 FROM setups s WHERE s.id = setup_id
      AND (request_owns_trader(s.trader_profile_id) OR request_has_staff_role('super_admin'))));
ALTER TABLE trader_execution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY trader_execution_public_read ON trader_execution_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM setups s WHERE s.id = setup_id AND s.is_demo = false));
CREATE POLICY trader_execution_owner_insert ON trader_execution_events FOR INSERT
  WITH CHECK ((actor_id = request_member_id() OR request_has_staff_role('super_admin'))
    AND (request_owns_trader(trader_profile_id) OR request_has_staff_role('super_admin')));
ALTER TABLE setup_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY setup_reviews_public_read ON setup_reviews FOR SELECT
  USING (EXISTS (SELECT 1 FROM setups s WHERE s.id = setup_id AND s.is_demo = false));
CREATE POLICY setup_review_owner_insert ON setup_reviews FOR INSERT
  WITH CHECK (created_by = request_member_id() AND request_owns_trader(trader_profile_id));

-- Weekly reports link back to original setup IDs. Public archive rows cannot
-- be copied or anonymously changed.
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_reports_public_read ON weekly_reports FOR SELECT
  USING (is_demo = false OR request_owns_trader(trader_profile_id) OR request_is_admin());
CREATE POLICY weekly_reports_trader_insert ON weekly_reports FOR INSERT
  WITH CHECK (is_demo = false AND authored_by = request_member_id() AND request_owns_trader(trader_profile_id));
ALTER TABLE weekly_report_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_setup_public_read ON weekly_report_setups FOR SELECT
  USING (EXISTS (SELECT 1 FROM weekly_reports wr WHERE wr.id = weekly_report_id AND wr.is_demo = false));
CREATE POLICY report_setup_trader_insert ON weekly_report_setups FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM weekly_reports wr WHERE wr.id = weekly_report_id
    AND request_owns_trader(wr.trader_profile_id)));

-- Course catalogue is public where designated; lesson content/progress and
-- assignments are protected by the same current entitlement check.
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY courses_catalogue_read ON courses FOR SELECT
  USING (published_at IS NOT NULL AND (access = 'public' OR request_is_premium() OR request_is_admin()));
CREATE POLICY courses_admin_insert ON courses FOR INSERT
  WITH CHECK (created_by = request_member_id() AND request_is_admin());
CREATE POLICY courses_admin_update ON courses FOR UPDATE
  USING (request_is_admin()) WITH CHECK (request_is_admin());
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_course_read ON course_modules FOR SELECT
  USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND request_can_access_course(c.id)));
CREATE POLICY modules_staff_insert ON course_modules FOR INSERT
  WITH CHECK (request_is_admin() OR request_is_course_mentor(course_id));
CREATE POLICY modules_staff_update ON course_modules FOR UPDATE
  USING (request_is_admin() OR request_is_course_mentor(course_id))
  WITH CHECK (request_is_admin() OR request_is_course_mentor(course_id));
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY lessons_course_read ON lessons FOR SELECT
  USING (published_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM course_modules m WHERE m.id = module_id AND request_can_access_course(m.course_id)
  ));
CREATE POLICY lessons_staff_insert ON lessons FOR INSERT
  WITH CHECK (request_is_admin() OR EXISTS (
    SELECT 1 FROM course_modules m WHERE m.id = module_id AND request_is_course_mentor(m.course_id)
  ));
CREATE POLICY lessons_staff_update ON lessons FOR UPDATE
  USING (request_is_admin() OR EXISTS (
    SELECT 1 FROM course_modules m WHERE m.id = module_id AND request_is_course_mentor(m.course_id)
  ))
  WITH CHECK (request_is_admin() OR EXISTS (
    SELECT 1 FROM course_modules m WHERE m.id = module_id AND request_is_course_mentor(m.course_id)
  ));
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_lesson_read ON assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM lessons l JOIN course_modules m ON m.id = l.module_id
    WHERE l.id = lesson_id AND l.published_at IS NOT NULL AND request_can_access_course(m.course_id)));
CREATE POLICY assignments_staff_manage ON assignments FOR ALL
  USING (request_is_admin() OR EXISTS (
    SELECT 1 FROM lessons l JOIN course_modules m ON m.id = l.module_id
    WHERE l.id = lesson_id AND request_is_course_mentor(m.course_id)
  ))
  WITH CHECK (request_is_admin() OR EXISTS (
    SELECT 1 FROM lessons l JOIN course_modules m ON m.id = l.module_id
    WHERE l.id = lesson_id AND request_is_course_mentor(m.course_id)
  ));
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY submissions_owner_or_mentor_read ON assignment_submissions FOR SELECT
  USING (member_id = request_member_id() OR request_is_admin() OR EXISTS (
    SELECT 1 FROM assignments a JOIN lessons l ON l.id = a.lesson_id
    JOIN course_modules m ON m.id = l.module_id
    WHERE a.id = assignment_id AND request_is_course_mentor(m.course_id)
  ));
CREATE POLICY submissions_owner_insert ON assignment_submissions FOR INSERT
  WITH CHECK (member_id = request_member_id() AND EXISTS (
    SELECT 1 FROM assignments a JOIN lessons l ON l.id = a.lesson_id
    JOIN course_modules m ON m.id = l.module_id
    WHERE a.id = assignment_id AND request_can_access_course(m.course_id)
  ));
CREATE POLICY submissions_mentor_update ON assignment_submissions FOR UPDATE
  USING (request_is_admin() OR EXISTS (
    SELECT 1 FROM assignments a JOIN lessons l ON l.id = a.lesson_id
    JOIN course_modules m ON m.id = l.module_id
    WHERE a.id = assignment_id AND request_is_course_mentor(m.course_id)
  ))
  WITH CHECK (request_is_admin() OR EXISTS (
    SELECT 1 FROM assignments a JOIN lessons l ON l.id = a.lesson_id
    JOIN course_modules m ON m.id = l.module_id
    WHERE a.id = assignment_id AND request_is_course_mentor(m.course_id)
  ));

ALTER TABLE course_mentors ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_mentors_self_or_admin_read ON course_mentors FOR SELECT
  USING (member_id = request_member_id() OR request_is_admin());
CREATE POLICY course_mentors_admin_manage ON course_mentors FOR ALL
  USING (request_is_admin()) WITH CHECK (request_is_admin() AND EXISTS (
    SELECT 1 FROM staff_grants g WHERE g.member_id = course_mentors.member_id
      AND g.role = 'founding_trader' AND g.revoked_at IS NULL
  ));

-- Private rows remain scoped to the member. Premium status itself is never a
-- writable role claim and is derived from subscriptions.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_reports_create ON content_reports FOR INSERT
  WITH CHECK (reporter_id = request_member_id());
CREATE POLICY content_reports_read_reporter_or_staff ON content_reports FOR SELECT
  USING (reporter_id = request_member_id() OR request_is_admin());
CREATE POLICY content_reports_staff_update ON content_reports FOR UPDATE
  USING (request_is_admin()) WITH CHECK (request_is_admin());
CREATE POLICY audit_log_staff_read ON audit_log FOR SELECT
  USING (request_is_admin());

-- DMs have no routine admin SELECT policy. A moderator can inspect only a message
-- named in an assigned open report (or a super admin can inspect the reported
-- message); every read writes an immutable audit row in the same transaction.
CREATE FUNCTION read_assigned_reported_message(report_uuid uuid)
RETURNS TABLE(message_id uuid, author_id uuid, body text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  reported_message uuid;
BEGIN
  IF NOT request_is_admin() THEN
    RAISE EXCEPTION 'moderator capability required';
  END IF;

  SELECT r.target_id INTO reported_message
  FROM content_reports r
  WHERE r.id = report_uuid AND r.target_kind = 'message'
    AND r.status IN ('open', 'reviewing')
    AND (r.assigned_to = request_member_id() OR request_has_staff_role('super_admin'))
  FOR UPDATE;

  IF reported_message IS NULL THEN
    RAISE EXCEPTION 'message report is unavailable or not assigned to this moderator';
  END IF;

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (request_member_id(), 'moderation.read_reported_message', 'message', reported_message,
    'Scoped content review', jsonb_build_object('report_id', report_uuid));

  RETURN QUERY
  SELECT m.id, m.author_id, m.body, m.created_at
  FROM messages m WHERE m.id = reported_message;
END;
$$;

-- Billing webhook receipts, staff grants, and audit writes have no member-facing
-- write policy. The trusted service role processes signed webhooks and writes audit
-- events. Never give that role or a bypass-RLS credential to the browser.
-- Configure grants so ordinary roles cannot execute SECURITY DEFINER helpers
-- beyond the authenticated API gateway. Storage policies must mirror object
-- ownership and room/course entitlement. All domain writes and audit events commit
-- in one transaction.
