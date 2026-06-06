
ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS auto_sync boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_ref text;

CREATE INDEX IF NOT EXISTS idx_knowledge_items_source_ref ON public.knowledge_items(source_ref) WHERE source_ref IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
