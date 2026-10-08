-- Allow the existing messages policies to evaluate their membership lookups.
-- RLS on both tables still limits visible rows to the caller's own membership
-- (or an administrator), so this does not expose other members' room or DM data.
-- Apply after the public group chat migration.

GRANT SELECT ON public.room_members, public.conversation_members TO anon, authenticated;
