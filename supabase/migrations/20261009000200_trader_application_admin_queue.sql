-- Repair the founder's administrator grant if the earlier bootstrap migration
-- ran before their member account existed, and restore the private queue's
-- administrator read policy. Safe to run once after the trader workflow set.
DO $$
DECLARE
  founder_id uuid;
BEGIN
  SELECT id INTO founder_id
  FROM public.members
  WHERE lower(email_private) = lower('ramphilipgarang@gmail.com')
  LIMIT 1;

  IF founder_id IS NULL THEN
    RAISE EXCEPTION 'The DRACARYS founder account must exist before enabling administrator access.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff_grants
    WHERE member_id = founder_id AND role = 'super_admin' AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.staff_grants (member_id, role, granted_by, reason)
    VALUES (founder_id, 'super_admin', founder_id, 'DRACARYS founder; trader application queue administrator');
  END IF;
END;
$$;

ALTER TABLE public.trader_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trader_applications_owner_or_admin_read ON public.trader_applications;
CREATE POLICY trader_applications_owner_or_admin_read ON public.trader_applications FOR SELECT
  USING (member_id = public.request_member_id() OR public.request_is_admin());
GRANT SELECT ON public.trader_applications TO authenticated;

NOTIFY pgrst, 'reload schema';
