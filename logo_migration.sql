-- Add has_logo column to workwear_templates
ALTER TABLE public.workwear_templates ADD COLUMN IF NOT EXISTS has_logo BOOLEAN DEFAULT FALSE;
