-- Fase 0.1: logos de exportacion por proyecto en Supabase (antes vivian en localStorage del navegador).
-- Permite que el servidor (funcion de generacion de actas) y la app usen la misma configuracion de logos,
-- y arregla la fragilidad de que los logos solo funcionaban en el PC que los configuro.

create table if not exists public.project_logos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  data_url text not null,
  position text not null,
  name text,
  size integer not null default 90 check (size between 40 and 360),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create index if not exists idx_project_logos_project on public.project_logos(project_id);

alter table public.project_logos enable row level security;

-- Los logos son configuracion compartida de exportacion, no dato sensible:
-- cualquier usuario autenticado puede leerlos; la UI ya restringe la gestion a administradores.
drop policy if exists "project_logos_select_authenticated" on public.project_logos;
create policy "project_logos_select_authenticated"
on public.project_logos for select
using (auth.uid() is not null);

drop policy if exists "project_logos_write_admin" on public.project_logos;
create policy "project_logos_write_admin"
on public.project_logos for all
using (public.has_default_role(array['admin']))
with check (public.has_default_role(array['admin']));
