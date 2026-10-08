-- Profile journal fields and owner-only access for the signed-in member.
ALTER TABLE public.personal_journal_entries
  ADD COLUMN title text NOT NULL DEFAULT 'Market reflection',
  ADD COLUMN market text NOT NULL DEFAULT '',
  ADD COLUMN entry_date date NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.personal_journal_entries
  ADD CONSTRAINT personal_journal_title_length CHECK (length(trim(title)) BETWEEN 2 AND 140),
  ADD CONSTRAINT personal_journal_market_length CHECK (length(market) <= 24);

CREATE POLICY journal_owner_delete ON public.personal_journal_entries FOR DELETE
  USING (member_id = public.request_member_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_journal_entries TO authenticated;

NOTIFY pgrst, 'reload schema';
