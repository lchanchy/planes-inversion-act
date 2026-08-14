create table if not exists public.counterpart_catalog (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  type text not null default 'mano_obra' check (type in ('mano_obra', 'material_propio', 'otro')),
  suggested_unit text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

alter table public.counterpart_catalog
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists name text,
  add column if not exists type text,
  add column if not exists suggested_unit text,
  add column if not exists description text,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists is_deleted boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'counterpart_catalog'
      and column_name = 'contribution_type'
  ) then
    update public.counterpart_catalog
    set type = case
      when contribution_type = 'materiales_propios' then 'material_propio'
      when contribution_type in ('mano_obra', 'otro') then contribution_type
      else 'otro'
    end
    where type is null;

    -- La migracion anterior usaba contribution_type y una restriccion unica
    -- con ese nombre. Terminada la copia, se reemplaza por el contrato actual.
    alter table public.counterpart_catalog drop constraint if exists counterpart_catalog_unique;
    alter table public.counterpart_catalog drop column contribution_type;
  end if;
end $$;

update public.counterpart_catalog
set type = 'mano_obra'
where type is null;

alter table public.counterpart_catalog
  alter column name set not null,
  alter column type set not null,
  alter column active set default true,
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column is_deleted set default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'counterpart_catalog_type_check'
      and conrelid = 'public.counterpart_catalog'::regclass
  ) then
    alter table public.counterpart_catalog
      add constraint counterpart_catalog_type_check check (type in ('mano_obra', 'material_propio', 'otro'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'counterpart_catalog_unique'
      and conrelid = 'public.counterpart_catalog'::regclass
  ) then
    alter table public.counterpart_catalog
      add constraint counterpart_catalog_unique unique nulls not distinct (project_id, name, type, suggested_unit);
  end if;
end $$;

create index if not exists idx_counterpart_catalog_project on public.counterpart_catalog(project_id);
create index if not exists idx_counterpart_catalog_active on public.counterpart_catalog(active) where is_deleted = false;

drop trigger if exists trg_counterpart_catalog_audit on public.counterpart_catalog;
create trigger trg_counterpart_catalog_audit
before insert or update on public.counterpart_catalog
for each row execute function public.set_audit_fields();

alter table public.counterpart_catalog enable row level security;

drop policy if exists "counterpart_catalog_select_members" on public.counterpart_catalog;
create policy "counterpart_catalog_select_members"
on public.counterpart_catalog for select
using (
  project_id is null
  or public.is_project_member(project_id)
);

drop policy if exists "counterpart_catalog_write_admin_coord" on public.counterpart_catalog;
create policy "counterpart_catalog_write_admin_coord"
on public.counterpart_catalog for all
using (
  project_id is null
  or public.has_project_role(project_id, array['admin', 'coordinator'])
)
with check (
  project_id is null
  or public.has_project_role(project_id, array['admin', 'coordinator'])
);

grant select, insert, update, delete on public.counterpart_catalog to authenticated;

insert into public.counterpart_catalog (project_id, name, type, suggested_unit, description, active)
values
  (null, 'Mano de obra familiar', 'mano_obra', 'jornal', 'Aporte en jornales de la familia para implementacion o mantenimiento.', true),
  (null, 'Estacas propias', 'material_propio', 'unidad', 'Estacas aportadas directamente por la familia.', true),
  (null, 'Transporte familiar', 'otro', 'viaje', 'Apoyo de transporte asumido por la familia.', true),
  (null, 'Herramientas propias', 'material_propio', 'unidad', 'Uso de herramientas propias durante la actividad.', true)
on conflict (project_id, name, type, suggested_unit) do update
set
  description = excluded.description,
  active = true,
  is_deleted = false,
  updated_at = now();

notify pgrst, 'reload schema';
