-- Additive migration: existing farms remain valid with an unknown stage.
SET lock_timeout = '5s';
ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS crop_stage jsonb;
