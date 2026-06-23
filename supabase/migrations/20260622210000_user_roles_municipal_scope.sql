-- Fase 7: roles ampliados y alcance municipal para usuarios tecnicos.
-- No guarda contrasenas; las contrasenas pertenecen a Supabase Auth.

alter table public.users_profiles
add column if not exists email text;

alter table public.users_profiles
alter column auth_user_id drop not null;

create unique index if not exists users_profiles_email_unique
on public.users_profiles(lower(email))
where email is not null and is_deleted = false;

insert into public.roles (name, description, permissions)
values
  ('super_admin', 'Administrador general con acceso total al aplicativo web.', '{"scope":"all_projects","all":true}'::jsonb),
  ('project_admin', 'Administrador por proyecto con acceso total al proyecto asignado.', '{"scope":"project","all_project":true}'::jsonb),
  ('municipal_technician', 'Usuario tecnico asignado por municipio.', '{"scope":"municipality","plans":true,"indicators_progress":true,"maintenance_progress":true,"delivery_acts":true}'::jsonb)
on conflict (name) do update
set description = excluded.description,
    permissions = excluded.permissions,
    updated_at = now();

create table if not exists public.user_municipality_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users_profiles(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint user_municipality_assignments_unique unique (project_id, user_id, municipality_id)
);

create index if not exists idx_user_municipality_assignments_project
on public.user_municipality_assignments(project_id);

create index if not exists idx_user_municipality_assignments_user
on public.user_municipality_assignments(user_id);

create index if not exists idx_user_municipality_assignments_municipality
on public.user_municipality_assignments(municipality_id);

drop trigger if exists set_audit_user_municipality_assignments on public.user_municipality_assignments;
create trigger set_audit_user_municipality_assignments
before insert or update on public.user_municipality_assignments
for each row execute function public.set_audit_fields();

create or replace function public.has_project_role(p_project_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_default_role(array['super_admin'])
    or exists (
      select 1
      from public.project_users pu
      join public.roles r on r.id = pu.role_id
      where pu.project_id = p_project_id
        and pu.user_id = public.current_profile_id()
        and pu.status = 'active'
        and pu.is_deleted = false
        and (
          r.name = any(p_roles)
          or (r.name = 'project_admin' and ('admin' = any(p_roles) or 'coordinator' = any(p_roles) or 'project_admin' = any(p_roles)))
          or (r.name = 'municipal_technician' and 'technician' = any(p_roles))
        )
        and r.is_deleted = false
    );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_default_role(array['super_admin'])
    or exists (
      select 1
      from public.project_users pu
      where pu.project_id = p_project_id
        and pu.user_id = public.current_profile_id()
        and pu.status = 'active'
        and pu.is_deleted = false
    )
    or exists (
      select 1
      from public.user_municipality_assignments uma
      where uma.project_id = p_project_id
        and uma.user_id = public.current_profile_id()
        and uma.status = 'active'
        and uma.is_deleted = false
    );
$$;

create or replace function public.can_access_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.families f
    where f.id = p_family_id
      and (
        public.has_default_role(array['super_admin'])
        or public.has_project_role(f.project_id, array['admin', 'coordinator', 'viewer', 'auditor', 'project_admin'])
        or exists (
          select 1
          from public.family_assignments fa
          where fa.family_id = f.id
            and fa.technician_id = public.current_profile_id()
            and fa.status = 'active'
            and fa.is_deleted = false
        )
        or exists (
          select 1
          from public.user_municipality_assignments uma
          where uma.project_id = f.project_id
            and uma.user_id = public.current_profile_id()
            and uma.municipality_id = f.municipality_id
            and uma.status = 'active'
            and uma.is_deleted = false
        )
      )
  );
$$;

drop policy if exists "profiles_select_own_or_project_admin" on public.users_profiles;
create policy "profiles_select_own_or_project_admin"
on public.users_profiles for select
using (
  auth_user_id = auth.uid()
  or public.has_default_role(array['admin', 'super_admin'])
  or exists (
    select 1
    from public.project_users pu
    join public.roles r on r.id = pu.role_id
    where pu.user_id = users_profiles.id
      and public.has_project_role(pu.project_id, array['admin', 'coordinator', 'project_admin'])
      and r.is_deleted = false
  )
);

drop policy if exists "profiles_insert_own" on public.users_profiles;
create policy "profiles_insert_own"
on public.users_profiles for insert
with check (
  auth_user_id = auth.uid()
  or public.has_default_role(array['admin', 'super_admin'])
);

drop policy if exists "profiles_update_own_or_default_admin" on public.users_profiles;
create policy "profiles_update_own_or_default_admin"
on public.users_profiles for update
using (auth_user_id = auth.uid() or public.has_default_role(array['admin', 'super_admin']))
with check (auth_user_id = auth.uid() or public.has_default_role(array['admin', 'super_admin']));

drop policy if exists "roles_write_default_admin" on public.roles;
create policy "roles_write_default_admin"
on public.roles for all
using (public.has_default_role(array['admin', 'super_admin']))
with check (public.has_default_role(array['admin', 'super_admin']));

drop policy if exists "projects_insert_default_admin" on public.projects;
create policy "projects_insert_default_admin"
on public.projects for insert
with check (public.has_default_role(array['admin', 'super_admin']));

drop policy if exists "projects_update_admins" on public.projects;
create policy "projects_update_admins"
on public.projects for update
using (public.has_project_role(id, array['admin', 'project_admin']))
with check (public.has_project_role(id, array['admin', 'project_admin']));

drop policy if exists "project_users_write_admins" on public.project_users;
create policy "project_users_write_admins"
on public.project_users for all
using (public.has_project_role(project_id, array['admin', 'project_admin']))
with check (public.has_project_role(project_id, array['admin', 'project_admin']));

alter table public.user_municipality_assignments enable row level security;

drop policy if exists "user_municipality_assignments_select_scoped" on public.user_municipality_assignments;
create policy "user_municipality_assignments_select_scoped"
on public.user_municipality_assignments for select
using (
  user_id = public.current_profile_id()
  or public.has_project_role(project_id, array['admin', 'coordinator', 'project_admin'])
);

drop policy if exists "user_municipality_assignments_write_admins" on public.user_municipality_assignments;
create policy "user_municipality_assignments_write_admins"
on public.user_municipality_assignments for all
using (public.has_project_role(project_id, array['admin', 'coordinator', 'project_admin']))
with check (public.has_project_role(project_id, array['admin', 'coordinator', 'project_admin']));

grant select, insert, update on public.user_municipality_assignments to authenticated;
grant execute on function public.has_project_role(uuid, text[]) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_access_family(uuid) to authenticated;

notify pgrst, 'reload schema';
