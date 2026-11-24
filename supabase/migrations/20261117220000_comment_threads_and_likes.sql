begin;

alter table public.resena_respuestas
  add column if not exists id_respuesta_padre uuid
  references public.resena_respuestas(id_respuesta) on delete cascade;

create table if not exists public.respuesta_likes (
  id_respuesta uuid not null references public.resena_respuestas(id_respuesta) on delete cascade,
  id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
  creado_el timestamptz default now(),
  primary key (id_respuesta, id_usuario)
);

alter table public.respuesta_likes enable row level security;
grant select, insert, delete on public.respuesta_likes to authenticated;
grant select on public.respuesta_likes to anon;

drop policy if exists "Cualquiera puede leer likes de respuestas" on public.respuesta_likes;
create policy "Cualquiera puede leer likes de respuestas"
  on public.respuesta_likes for select using (true);

drop policy if exists "Usuarios autenticados dan like a respuestas" on public.respuesta_likes;
create policy "Usuarios autenticados dan like a respuestas"
  on public.respuesta_likes for insert with check (auth.uid() = id_usuario);

drop policy if exists "Usuarios autenticados retiran su like de respuestas" on public.respuesta_likes;
create policy "Usuarios autenticados retiran su like de respuestas"
  on public.respuesta_likes for delete using (auth.uid() = id_usuario);

notify pgrst, 'reload schema';
commit;
