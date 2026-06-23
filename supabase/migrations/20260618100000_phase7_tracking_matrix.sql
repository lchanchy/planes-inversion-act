-- Fase 7: matriz anual de seguimiento por familia, actividad y trimestre.
-- Migracion nueva; no modifica migraciones anteriores.

alter table public.families
add column if not exists birth_date date;

create table if not exists public.quarterly_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  operational_plan_id uuid references public.operational_plans(id) on delete set null,
  plan_activity_id uuid references public.plan_activities(id) on delete set null,
  activity_id uuid references public.activity_catalog(id) on delete set null,
  year integer not null check (year between 2000 and 2100),
  quarter integer check (quarter between 1 and 4),
  target_quantity numeric(14,2) not null default 0 check (target_quantity >= 0),
  progress_quantity numeric(14,2) not null default 0 check (progress_quantity >= 0),
  progress_type text not null
    check (progress_type in ('avance', 'entregados', 'sembrados', 'cumplimiento_acuerdo')),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint quarterly_progress_quarter_required check (
    (progress_type = 'cumplimiento_acuerdo' and quarter is null)
    or (progress_type <> 'cumplimiento_acuerdo' and quarter is not null and plan_activity_id is not null)
  )
);

create index if not exists idx_quarterly_progress_project on public.quarterly_progress(project_id);
create index if not exists idx_quarterly_progress_family on public.quarterly_progress(family_id);
create index if not exists idx_quarterly_progress_plan_activity on public.quarterly_progress(plan_activity_id);
create index if not exists idx_quarterly_progress_year on public.quarterly_progress(year);

create unique index if not exists quarterly_progress_activity_unique
on public.quarterly_progress(project_id, family_id, plan_activity_id, year, quarter, progress_type)
where is_deleted = false and plan_activity_id is not null;

create unique index if not exists quarterly_progress_agreement_unique
on public.quarterly_progress(project_id, family_id, year, progress_type)
where is_deleted = false and progress_type = 'cumplimiento_acuerdo';

drop trigger if exists set_audit_quarterly_progress on public.quarterly_progress;
create trigger set_audit_quarterly_progress
before insert or update on public.quarterly_progress
for each row execute function public.set_audit_fields();

create or replace function public.validate_phase7_quarterly_progress()
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
    raise exception 'El avance no coincide con el proyecto de la familia.';
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
      raise exception 'El plan operativo no coincide con el avance.';
    end if;

    if v_plan.status <> 'approved' then
      raise exception 'Solo se registran avances sobre planes operativos aprobados.';
    end if;
  end if;

  if new.plan_activity_id is not null then
    select pa.id, pa.plan_id, pa.activity_id, pa.target
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
    new.target_quantity = coalesce(nullif(new.target_quantity, 0), v_activity.target, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists validate_phase7_quarterly_progress on public.quarterly_progress;
create trigger validate_phase7_quarterly_progress
before insert or update on public.quarterly_progress
for each row execute function public.validate_phase7_quarterly_progress();

alter table public.quarterly_progress enable row level security;

drop policy if exists "quarterly_progress_select_scoped" on public.quarterly_progress;
create policy "quarterly_progress_select_scoped"
on public.quarterly_progress for select
using (public.can_access_family(family_id));

drop policy if exists "quarterly_progress_insert_scoped" on public.quarterly_progress;
create policy "quarterly_progress_insert_scoped"
on public.quarterly_progress for insert
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

drop policy if exists "quarterly_progress_update_scoped" on public.quarterly_progress;
create policy "quarterly_progress_update_scoped"
on public.quarterly_progress for update
using (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
)
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

grant select, insert, update on public.quarterly_progress to authenticated;

notify pgrst, 'reload schema';
