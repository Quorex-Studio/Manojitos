-- Memoria de la asistente (Ángela / Ina). Sin DROP: se puede reaplicar.
--
-- 1) customer_memory (lo que vio y preguntó cada persona) nunca guardaba nada: la edge function
--    hace upsert con onConflict (customer_user_id, memory_key) y el único índice único era
--    parcial (WHERE customer_user_id IS NOT NULL), que ON CONFLICT no reconoce. Se agrega el
--    índice completo (los NULL siguen siendo distintos, así que no cambia lo que se permite).
create unique index if not exists customer_memory_customer_key_full
  on public.customer_memory (customer_user_id, memory_key);

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'customer_memory' and policyname = 'Customers can delete own memory') then
    create policy "Customers can delete own memory" on public.customer_memory
      for delete to authenticated using (customer_user_id = (select auth.uid()));
  end if;
end $$;

-- 2) La conversación de cada persona: al volver a abrir el chat sigue donde iba.
--    Solo la escribe la edge function (service role); la persona la lee y la borra.
create table if not exists public.assistant_conversations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_conversations enable row level security;

-- 3) Lo que la asistente decide recordar: datos y preferencias (talla, tono, estilo…) y
--    recordatorios con fecha ("recuérdame cobrarle a María el viernes").
create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'dato' check (kind in ('dato', 'preferencia', 'recordatorio')),
  content text not null check (char_length(content) between 2 and 300),
  remind_on date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists assistant_memories_user_idx on public.assistant_memories (user_id, created_at desc);

alter table public.assistant_memories enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'assistant_conversations' and policyname = 'Cada persona lee su conversación') then
    create policy "Cada persona lee su conversación" on public.assistant_conversations
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assistant_conversations' and policyname = 'Cada persona borra su conversación') then
    create policy "Cada persona borra su conversación" on public.assistant_conversations
      for delete to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assistant_memories' and policyname = 'Cada persona ve lo que la asistente recuerda de ella') then
    create policy "Cada persona ve lo que la asistente recuerda de ella" on public.assistant_memories
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assistant_memories' and policyname = 'Cada persona borra lo que la asistente recuerda de ella') then
    create policy "Cada persona borra lo que la asistente recuerda de ella" on public.assistant_memories
      for delete to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'assistant_memories' and policyname = 'Cada persona marca sus recordatorios') then
    create policy "Cada persona marca sus recordatorios" on public.assistant_memories
      for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;
end $$;

grant select, delete on public.assistant_conversations to authenticated;
grant select, update, delete on public.assistant_memories to authenticated;
