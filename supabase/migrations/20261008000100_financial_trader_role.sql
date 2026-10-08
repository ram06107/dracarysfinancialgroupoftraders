-- Keep the original founding-trader role distinct from traders approved later.
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'financial_trader';
