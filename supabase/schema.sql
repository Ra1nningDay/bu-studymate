create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists knowledge_items (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  category text not null,
  content text not null,
  keywords text[] not null default '{}',
  source text,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text unique not null,
  line_user_id text not null,
  location text,
  room text,
  description text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  state text not null default 'IDLE',
  draft_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists knowledge_items_updated_at on knowledge_items;
create trigger knowledge_items_updated_at
before update on knowledge_items
for each row execute function set_updated_at();

drop trigger if exists tickets_updated_at on tickets;
create trigger tickets_updated_at
before update on tickets
for each row execute function set_updated_at();

drop trigger if exists chat_sessions_updated_at on chat_sessions;
create trigger chat_sessions_updated_at
before update on chat_sessions
for each row execute function set_updated_at();

create index if not exists knowledge_items_category_idx on knowledge_items (category);
create index if not exists knowledge_items_keywords_idx on knowledge_items using gin (keywords);
create index if not exists tickets_ticket_code_idx on tickets (ticket_code);
create index if not exists tickets_status_idx on tickets (status);
create index if not exists chat_sessions_line_user_id_idx on chat_sessions (line_user_id);

-- TODO: Add match_knowledge_items SQL function and an ivfflat/hnsw vector index
-- when the MVP is ready for full pgvector RAG.
