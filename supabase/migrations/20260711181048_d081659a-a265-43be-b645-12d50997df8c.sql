create extension if not exists vector;

alter table public.knowledge_items add column if not exists embedding vector(1536);

create or replace function public.match_knowledge_items(
  p_chatbot_id uuid,
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  type text,
  title text,
  content text,
  question text,
  answer text,
  file_url text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ki.id,
    ki.type,
    ki.title,
    ki.content,
    ki.question,
    ki.answer,
    ki.file_url,
    1 - (ki.embedding <=> query_embedding) as similarity
  from public.knowledge_items ki
  where ki.chatbot_id = p_chatbot_id
    and ki.embedding is not null
  order by ki.embedding <=> query_embedding
  limit match_count
$$;

grant execute on function public.match_knowledge_items(uuid, vector, int) to authenticated, service_role;