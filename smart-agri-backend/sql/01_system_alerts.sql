-- ============================================================================
-- system_alerts: backs the dashboard notification bell (previously calling
-- endpoints that didn't exist). Populated by automation.service.ts whenever
-- the auto-irrigation loop makes a decision worth surfacing to the farmer.
-- Run after 00_existing_schema_reference.sql.
-- ============================================================================

create table if not exists public.system_alerts (
  id uuid not null default gen_random_uuid(),
  device_id text not null,
  severity text not null default 'INFO'::text,
  message text not null,
  created_at timestamp with time zone not null default now(),
  read_at timestamp with time zone null,
  constraint system_alerts_pkey primary key (id),
  constraint system_alerts_severity_check check (
    severity = any (array['CRITICAL'::text, 'WARNING'::text, 'INFO'::text])
  ),
  constraint valid_system_alerts_message check (char_length(trim(both from message)) > 0)
);

create index if not exists system_alerts_unread_index
  on public.system_alerts using btree (device_id, created_at desc)
  where (read_at is null);
