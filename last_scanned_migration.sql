-- Add last_scanned_at column to commissions table
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;
