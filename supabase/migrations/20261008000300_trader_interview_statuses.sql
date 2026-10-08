-- Keep enum changes isolated: the next migration relies on these values after
-- PostgreSQL has committed them.
ALTER TYPE public.trader_application_status
  ADD VALUE IF NOT EXISTS 'interview_scheduled';
ALTER TYPE public.trader_application_status
  ADD VALUE IF NOT EXISTS 'interview_completed';
