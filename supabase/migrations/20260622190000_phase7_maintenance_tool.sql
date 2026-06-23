-- Fase 7: herramienta de mantenimiento por familia, actividad, anio y trimestre.
-- Migracion nueva; no modifica migraciones anteriores.

alter table public.activity_catalog
add column if not exists maintenance_enabled boolean not null default true,
add column if not exists maintenance_deshierbe_required integer not null default 1,
add column if not exists maintenance_deshierbe_optional integer not null default 0,
add column if not exists maintenance_fertilization_required integer not null default 1,
add column if not exists maintenance_fertilization_optional integer not null default 0,
add column if not exists maintenance_pruning_required integer not null default 1,
add column if not exists maintenance_pruning_optional integer not null default 0,
add column if not exists maintenance_replanting_required integer not null default 0,
add column if not exists maintenance_replanting_optional integer not null default 0,
add column if not exists maintenance_organic_fertilizer boolean not null default false;

alter table public.activity_catalog
drop constraint if exists activity_catalog_maintenance_counts_check;

alter table public.activity_catalog
add constraint activity_catalog_maintenance_counts_check
check (
  maintenance_deshierbe_required >= 0
  and maintenance_deshierbe_optional >= 0
  and maintenance_fertilization_required >= 0
  and maintenance_fertilization_optional >= 0
  and maintenance_pruning_required >= 0
  and maintenance_pruning_optional >= 0
  and maintenance_replanting_required >= 0
  and maintenance_replanting_optional >= 0
);

create table if not exists public.maintenance_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  operational_plan_id uuid references public.operational_plans(id) on delete cascade,
  plan_activity_id uuid references public.plan_activities(id) on delete cascade,
  activity_id uuid references public.activity_catalog(id) on delete set null,
  year integer not null check (year between 2000 and 2100),
  quarter integer check (quarter between 1 and 4),
  maintenance_type text not null
    check (maintenance_type in ('deshierbe', 'fertilizacion', 'poda', 'resiembra', 'abono_liquido', 'abono_solido')),
  maintenance_number integer not null default 1 check (maintenance_number >= 1),
  maintenance_date date,
  progress_quantity numeric(14,2) not null default 0 check (progress_quantity >= 0),
  unit text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint maintenance_progress_value_scope_check check (
    (maintenance_type in ('abono_liquido', 'abono_solido') and quarter is not null and maintenance_date is null)
    or (maintenance_type in ('deshierbe', 'fertilizacion', 'poda', 'resiembra') and quarter is null)
  )
);

create index if not exists idx_maintenance_progress_project on public.maintenance_progress(project_id);
create index if not exists idx_maintenance_progress_family on public.maintenance_progress(family_id);
create index if not exists idx_maintenance_progress_plan_activity on public.maintenance_progress(plan_activity_id);
create index if not exists idx_maintenance_progress_year on public.maintenance_progress(year);

create unique index if not exists maintenance_progress_unique
on public.maintenance_progress(project_id, family_id, coalesce(plan_activity_id, '00000000-0000-0000-0000-000000000000'::uuid), year, coalesce(quarter, 0), maintenance_type, maintenance_number)
where is_deleted = false;

drop trigger if exists set_audit_maintenance_progress on public.maintenance_progress;
create trigger set_audit_maintenance_progress
before insert or update on public.maintenance_progress
for each row execute function public.set_audit_fields();

create or replace function public.validate_phase7_maintenance_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family record;
  v_plan record;
  v_activity record;
begin
  select id, project_id
  into v_family
  from public.families
  where id = new.family_id
    and is_deleted = false;

  if not found then
    raise exception 'La familia no existe o fue eliminada.';
  end if;

  if new.project_id <> v_family.project_id then
    raise exception 'El mantenimiento no coincide con el proyecto de la familia.';
  end if;

  if new.operational_plan_id is not null then
    select id, project_id, family_id, status
    into v_plan
    from public.operational_plans
    where id = new.operational_plan_id
      and is_deleted = false;

    if not found then
      raise exception 'El plan operativo no existe o fue eliminado.';
    end if;

    if v_plan.project_id <> new.project_id or v_plan.family_id <> new.family_id then
      raise exception 'El plan operativo no coincide con el mantenimiento.';
    end if;

    if v_plan.status <> 'approved' then
      raise exception 'Solo se registra mantenimiento sobre planes operativos aprobados.';
    end if;
  elsif new.maintenance_type not in ('abono_liquido', 'abono_solido') then
    raise exception 'Las actividades de mantenimiento requieren plan operativo aprobado.';
  end if;

  if new.plan_activity_id is not null then
    select pa.id, pa.plan_id, pa.activity_id
    into v_activity
    from public.plan_activities pa
    where pa.id = new.plan_activity_id
      and pa.is_deleted = false;

    if not found then
      raise exception 'La actividad del plan no existe o fue eliminada.';
    end if;

    if new.operational_plan_id is not null and v_activity.plan_id <> new.operational_plan_id then
      raise exception 'La actividad no pertenece al plan operativo indicado.';
    end if;

    new.activity_id = coalesce(new.activity_id, v_activity.activity_id);
  elsif new.maintenance_type not in ('abono_liquido', 'abono_solido') then
    raise exception 'Las actividades de mantenimiento requieren actividad del plan.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_phase7_maintenance_progress on public.maintenance_progress;
create trigger validate_phase7_maintenance_progress
before insert or update on public.maintenance_progress
for each row execute function public.validate_phase7_maintenance_progress();

alter table public.maintenance_progress enable row level security;

drop policy if exists "maintenance_progress_select_scoped" on public.maintenance_progress;
create policy "maintenance_progress_select_scoped"
on public.maintenance_progress for select
using (public.can_access_family(family_id));

drop policy if exists "maintenance_progress_insert_scoped" on public.maintenance_progress;
create policy "maintenance_progress_insert_scoped"
on public.maintenance_progress for insert
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

drop policy if exists "maintenance_progress_update_scoped" on public.maintenance_progress;
create policy "maintenance_progress_update_scoped"
on public.maintenance_progress for update
using (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
)
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

grant select, insert, update on public.maintenance_progress to authenticated;

notify pgrst, 'reload schema';
