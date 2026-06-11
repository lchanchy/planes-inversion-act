create table if not exists public.counterpart_catalog (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  contribution_type text not null check (contribution_type in ('mano_obra', 'materiales_propios', 'otro')),
  suggested_unit text not null,
  active boolean not null default true,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint counterpart_catalog_unique unique (project_id, name, contribution_type, suggested_unit)
);

create index if not exists idx_counterpart_catalog_project on public.counterpart_catalog(project_id);

drop trigger if exists trg_counterpart_catalog_audit on public.counterpart_catalog;
create trigger trg_counterpart_catalog_audit
before insert or update on public.counterpart_catalog
for each row execute function public.set_audit_fields();

alter table public.counterpart_catalog enable row level security;

drop policy if exists "counterpart_catalog_select_members" on public.counterpart_catalog;
create policy "counterpart_catalog_select_members"
on public.counterpart_catalog for select
using (project_id is null or public.is_project_member(project_id));

drop policy if exists "counterpart_catalog_write_admin_coord" on public.counterpart_catalog;
create policy "counterpart_catalog_write_admin_coord"
on public.counterpart_catalog for all
using (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']))
with check (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']));

grant select, insert, update, delete on public.counterpart_catalog to authenticated;
