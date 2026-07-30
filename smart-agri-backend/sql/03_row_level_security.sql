-- ============================================================================
-- Recommended Row Level Security policies.
--
-- Context: several frontend pages hold a live Supabase client in the browser
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY, public by design -- it ships in every page
-- load) for realtime subscriptions and a couple of optimistic-update writes.
-- Without RLS enabled, that key can read or write EVERY table, which means
-- the app's login/2FA/System-Control-password gates can be bypassed entirely
-- by calling Supabase directly (e.g. flipping `system_switches` or reading
-- `user_accounts.user_password_hash`) instead of going through the API.
--
-- The NestJS backend is unaffected by any of this: it authenticates with
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely.
--
-- Review before applying -- only you can run this (Supabase SQL editor).
-- Policies are dropped-then-recreated so the script is safe to re-run.
-- Every `alter table` below uses IF EXISTS, so this is also safe to run
-- before 04_ai_chat_history.sql -- that one line just becomes a no-op until
-- the table exists, instead of erroring out the whole script.
--
-- This script only changes ACCESS RULES (RLS flags + policies). It contains
-- no DELETE/TRUNCATE/DROP TABLE and cannot remove or modify any existing
-- rows -- Supabase's SQL editor shows a generic "destructive" warning on any
-- query containing DROP/ALTER (here: the idempotent `drop policy if exists`
-- lines), even though dropping a policy is a permission-rule change, not a
-- data change. Your data is unaffected either way.
-- ============================================================================

-- ── Never reachable via the anon/browser key: holds password hashes ────────
alter table if exists public.user_accounts enable row level security;
-- No policies created for anon/authenticated => default deny for both roles.
-- Only the service-role key (the backend) can read or write this table.

-- ── Actuator + log tables: dashboards may read, only the backend writes ────
alter table if exists public.system_switches enable row level security;
drop policy if exists system_switches_select on public.system_switches;
create policy system_switches_select on public.system_switches
  for select to anon, authenticated using (true);
-- No insert/update/delete policy => the frontend's old "direct Supabase
-- write, then also call the API" pattern (dashboard/page.tsx and
-- system-control/page.tsx) will now fail on the direct write, which is the
-- point -- pump/light control must go through the guarded API.

alter table if exists public.pump_activation_logs enable row level security;
drop policy if exists pump_activation_logs_select on public.pump_activation_logs;
create policy pump_activation_logs_select on public.pump_activation_logs
  for select to anon, authenticated using (true);

alter table if exists public.rain_predictions enable row level security;
drop policy if exists rain_predictions_select on public.rain_predictions;
create policy rain_predictions_select on public.rain_predictions
  for select to anon, authenticated using (true);

-- ── Chat + saved analyses: only ever touched through the backend today ─────
alter table if exists public.ai_chat_history enable row level security;
-- No anon/authenticated policies => not directly reachable from the browser.
-- (No-op until 04_ai_chat_history.sql creates the table.)

alter table if exists public."Wireless sensor Soil Analysis data" enable row level security;
-- No anon/authenticated policies => not directly reachable from the browser.

-- ── Sensor ingest tables: dashboards read these directly for realtime ──────
-- This repo has no firmware source, so it's unknown whether the physical
-- ESP32 node/receiver writes to Supabase using this same anon key. Rather
-- than guess, these four also get permissive insert/update policies -- RLS
-- turns on (so it's on record and consistent with the rest of this file),
-- but nothing about how the hardware writes today can break.
alter table if exists public.soil_readings enable row level security;
drop policy if exists soil_readings_select on public.soil_readings;
create policy soil_readings_select on public.soil_readings
  for select to anon, authenticated using (true);
drop policy if exists soil_readings_write on public.soil_readings;
create policy soil_readings_write on public.soil_readings
  for insert to anon, authenticated with check (true);

alter table if exists public.latest_soil_reading enable row level security;
drop policy if exists latest_soil_reading_select on public.latest_soil_reading;
create policy latest_soil_reading_select on public.latest_soil_reading
  for select to anon, authenticated using (true);
drop policy if exists latest_soil_reading_write on public.latest_soil_reading;
create policy latest_soil_reading_write on public.latest_soil_reading
  for insert to anon, authenticated with check (true);
drop policy if exists latest_soil_reading_update on public.latest_soil_reading;
create policy latest_soil_reading_update on public.latest_soil_reading
  for update to anon, authenticated using (true) with check (true);

alter table if exists public.soil_sensor_readings enable row level security;
drop policy if exists soil_sensor_readings_select on public.soil_sensor_readings;
create policy soil_sensor_readings_select on public.soil_sensor_readings
  for select to anon, authenticated using (true);
drop policy if exists soil_sensor_readings_write on public.soil_sensor_readings;
create policy soil_sensor_readings_write on public.soil_sensor_readings
  for insert to anon, authenticated with check (true);

alter table if exists public.environment_sensor_readings enable row level security;
drop policy if exists environment_sensor_readings_select on public.environment_sensor_readings;
create policy environment_sensor_readings_select on public.environment_sensor_readings
  for select to anon, authenticated using (true);
drop policy if exists environment_sensor_readings_write on public.environment_sensor_readings;
create policy environment_sensor_readings_write on public.environment_sensor_readings
  for insert to anon, authenticated with check (true);
