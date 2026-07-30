-- ============================================================================
-- Adds a persisted enable/disable flag to rain_predictions. Previously the
-- Local Weather page's toggle only forced will_rain=false once; it didn't
-- stop the next scheduled prediction from overwriting it, and reloading the
-- page always reset the toggle to "on" because nothing was ever read back.
-- Run after 00_existing_schema_reference.sql.
-- ============================================================================

alter table public.rain_predictions
  add column if not exists prediction_enabled boolean not null default true;
