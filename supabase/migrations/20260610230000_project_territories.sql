-- Fase 2 ajuste territorial:
-- Un proyecto puede intervenir varios departamentos, municipios y veredas.
-- No modifica la migracion inicial validada; agrega estructura normalizada incremental.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

alter table public.municipalities
  add column if not exists department_id uuid references public.departments(id) on delete restrict;

insert into public.departments (name)
select distinct trim(department)
from public.municipalities
where department is not null
  and trim(department) <> ''
on conflict (name) do nothing;

update public.municipalities m
set department_id = d.id
from public.departments d
where m.department_id is null
  and d.name = m.department;

create table if not exists public.project_departments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint project_departments_unique unique (project_id, department_id)
);

create table if not exists public.project_municipalities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint project_municipalities_unique unique (project_id, municipality_id)
);

create table if not exists public.project_villages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  village_id uuid not null references public.villages(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint project_villages_unique unique (project_id, village_id)
);

insert into public.project_departments (project_id, department_id)
select p.id, d.id
from public.projects p
join public.departments d on d.name = p.department
where p.department is not null
  and trim(p.department) <> ''
on conflict (project_id, department_id) do nothing;

insert into public.project_municipalities (project_id, municipality_id)
select distinct f.project_id, f.municipality_id
from public.families f
where f.municipality_id is not null
on conflict (project_id, municipality_id) do nothing;

insert into public.project_villages (project_id, village_id)
select distinct f.project_id, f.village_id
from public.families f
where f.village_id is not null
on conflict (project_id, village_id) do nothing;

create index if not exists idx_departments_name on public.departments(name);
create index if not exists idx_municipalities_department_id on public.municipalities(department_id);
create index if not exists idx_project_departments_project on public.project_departments(project_id);
create index if not exists idx_project_departments_department on public.project_departments(department_id);
create index if not exists idx_project_municipalities_project on public.project_municipalities(project_id);
create index if not exists idx_project_municipalities_municipality on public.project_municipalities(municipality_id);
create index if not exists idx_project_villages_project on public.project_villages(project_id);
create index if not exists idx_project_villages_village on public.project_villages(village_id);

drop trigger if exists trg_departments_audit on public.departments;
create trigger trg_departments_audit
before insert or update on public.departments
for each row execute function public.set_audit_fields();

drop trigger if exists trg_project_departments_audit on public.project_departments;
create trigger trg_project_departments_audit
before insert or update on public.project_departments
for each row execute function public.set_audit_fields();

drop trigger if exists trg_project_municipalities_audit on public.project_municipalities;
create trigger trg_project_municipalities_audit
before insert or update on public.project_municipalities
for each row execute function public.set_audit_fields();

drop trigger if exists trg_project_villages_audit on public.project_villages;
create trigger trg_project_villages_audit
before insert or update on public.project_villages
for each row execute function public.set_audit_fields();

alter table public.departments enable row level security;
alter table public.project_departments enable row level security;
alter table public.project_municipalities enable row level security;
alter table public.project_villages enable row level security;

drop policy if exists "departments_select_authenticated" on public.departments;
create policy "departments_select_authenticated"
on public.departments for select
using (auth.uid() is not null);

drop policy if exists "departments_write_admin_coord" on public.departments;
create policy "departments_write_admin_coord"
on public.departments for all
using (public.has_default_role(array['admin', 'coordinator']))
with check (public.has_default_role(array['admin', 'coordinator']));

drop policy if exists "project_departments_select_members" on public.project_departments;
create policy "project_departments_select_members"
on public.project_departments for select
using (public.is_project_member(project_id));

drop policy if exists "project_departments_write_admin_coord" on public.project_departments;
create policy "project_departments_write_admin_coord"
on public.project_departments for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "project_municipalities_select_members" on public.project_municipalities;
create policy "project_municipalities_select_members"
on public.project_municipalities for select
using (public.is_project_member(project_id));

drop policy if exists "project_municipalities_write_admin_coord" on public.project_municipalities;
create policy "project_municipalities_write_admin_coord"
on public.project_municipalities for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "project_villages_select_members" on public.project_villages;
create policy "project_villages_select_members"
on public.project_villages for select
using (public.is_project_member(project_id));

drop policy if exists "project_villages_write_admin_coord" on public.project_villages;
create policy "project_villages_write_admin_coord"
on public.project_villages for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.project_departments to authenticated;
grant select, insert, update, delete on public.project_municipalities to authenticated;
grant select, insert, update, delete on public.project_villages to authenticated;
