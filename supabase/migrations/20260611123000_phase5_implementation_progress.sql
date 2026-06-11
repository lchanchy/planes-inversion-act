-- Fase 5 ajuste: avances de implementacion para herramienta de indicadores.
-- Migracion separada; no modifica migraciones anteriores.

create table if not exists public.implementation_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  operational_plan_id uuid references public.operational_plans(id) on delete set null,
  plan_activity_id uuid references public.plan_activities(id) on delete set null,
  material_id uuid references public.material_catalog(id) on delete set null,
  indicator_name text,
  unit text,
  target_quantity numeric(14,2),
  delivered_quantity numeric(14,2) not null default 0 check (delivered_quantity >= 0),
  implemented_quantity numeric(14,2) not null default 0 check (implemented_quantity >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
  observations text,
  progress_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint implementation_progress_scope_check check (
    plan_activity_id is not null or material_id is not null or indicator_name is not null
  )
);

create index if not exists idx_implementation_progress_project on public.implementation_progress(project_id);
create index if not exists idx_implementation_progress_family on public.implementation_progress(family_id);
create index if not exists idx_implementation_progress_plan on public.implementation_progress(operational_plan_id);
create index if not exists idx_implementation_progress_activity on public.implementation_progress(plan_activity_id);
create index if not exists idx_implementation_progress_material on public.implementation_progress(material_id);
create index if not exists idx_implementation_progress_status on public.implementation_progress(status);

drop trigger if exists set_audit_implementation_progress on public.implementation_progress;
create trigger set_audit_implementation_progress
before insert or update on public.implementation_progress
for each row execute function public.set_audit_fields();

create or replace function public.validate_phase5_implementation_progress()
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
    select pa.id, pa.plan_id, pa.activity_id, pa.unit, pa.target
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

    new.unit = coalesce(new.unit, v_activity.unit);
    new.target_quantity = coalesce(new.target_quantity, v_activity.target);
  end if;

  return new;
end;
$$;

drop trigger if exists validate_phase5_implementation_progress on public.implementation_progress;
create trigger validate_phase5_implementation_progress
before insert or update on public.implementation_progress
for each row execute function public.validate_phase5_implementation_progress();

alter table public.implementation_progress enable row level security;

drop policy if exists "implementation_progress_select_scoped" on public.implementation_progress;
create policy "implementation_progress_select_scoped"
on public.implementation_progress for select
using (public.can_access_family(family_id));

drop policy if exists "implementation_progress_insert_scoped" on public.implementation_progress;
create policy "implementation_progress_insert_scoped"
on public.implementation_progress for insert
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

drop policy if exists "implementation_progress_update_scoped" on public.implementation_progress;
create policy "implementation_progress_update_scoped"
on public.implementation_progress for update
using (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
)
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

grant select, insert, update on public.implementation_progress to authenticated;

notify pgrst, 'reload schema';
