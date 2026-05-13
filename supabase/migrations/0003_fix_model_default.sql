-- ════════════════════════════════════════════════════════════════════════════
--  Update the default Claude model on `insights` to a currently-available ID.
--  The original `claude-opus-4-6` was never published; current stable Opus is
--  `claude-opus-4-7`. Existing rows are left alone.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.insights
  alter column model set default 'claude-opus-4-7';
