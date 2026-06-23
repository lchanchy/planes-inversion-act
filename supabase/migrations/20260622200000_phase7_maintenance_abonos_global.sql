-- Fase 7: ajustes de herramienta de mantenimiento.
-- Resiembras siempre opcionales y abonos organicos globales al final de la herramienta.

alter table public.activity_catalog
alter column maintenance_replanting_required set default 0;

update public.activity_catalog
set maintenance_replanting_required = 0
where maintenance_replanting_required <> 0;

alter table public.maintenance_progress
alter column operational_plan_id drop not null,
alter column plan_activity_id drop not null;

drop index if exists public.maintenance_progress_unique;

create unique index if not exists maintenance_progress_unique
on public.maintenance_progress(
  project_id,
  family_id,
  coalesce(plan_activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
  year,
  coalesce(quarter, 0),
  maintenance_type,
  maintenance_number
)
where is_deleted = false;

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

notify pgrst, 'reload schema';
