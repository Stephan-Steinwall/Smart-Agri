-- ============================================================================
-- ai_chat_history: powers conversation history for BOTH the full AI
-- Assistant page and the dashboard's quick-chat popup (same table, different
-- session_id values -- the popup always uses 'dashboard_quick_chat').
--
-- This table was referenced by ai.service.ts from the start but was never
-- actually created in Supabase, so every chat reply was generated correctly
-- but silently failed to save, and every history/session lookup silently
-- came back empty. This migration is REQUIRED, not optional -- run it in the
-- Supabase SQL editor.
-- ============================================================================

create table if not exists public.ai_chat_history (
  id uuid not null default gen_random_uuid(),
  session_id text not null,
  role text not null,
  content text not null,
  created_at timestamp with time zone not null default now(),
  constraint ai_chat_history_pkey primary key (id),
  constraint ai_chat_history_role_check check (role = any (array['user'::text, 'assistant'::text]))
);

create index if not exists idx_ai_chat_history_session
  on public.ai_chat_history using btree (session_id, created_at);
