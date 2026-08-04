-- Material vegetal de contrapartida: agrega las 7 semillas como categorias y el sembrado
-- manual por familia/trimestre (progress_type propio 'contrapartida_siembra').
-- Migracion nueva; aditiva, no modifica migraciones anteriores validadas.

-- 1) Categorias de contrapartida: agrega las 7 semillas a las ya existentes.
alter table public.plan_family_counterparts
drop constraint if exists plan_family_counterparts_vegetal_group_check;

alter table public.plan_family_counterparts
add constraint plan_family_counterparts_vegetal_group_check
check (
  vegetal_indicator_group is null
  or vegetal_indicator_group in (
    'colinos', 'cacao', 'frutales', 'forestales_nativos', 'otro',
    'semilla_frijol', 'semilla_maiz', 'semilla_yuca', 'semilla_sandia',
    'semilla_ahuyama', 'semilla_cana', 'semilla_bore'
  )
);

-- 2) quarterly_progress: nuevo tipo 'contrapartida_siembra' y categorias ampliadas (incluye semillas).
alter table public.quarterly_progress
drop constraint if exists quarterly_progress_vegetal_indicator_group_check;

alter table public.quarterly_progress
add constraint quarterly_progress_vegetal_indicator_group_check
check (
  vegetal_indicator_group is null
  or vegetal_indicator_group in (
    'colinos', 'cacao', 'frutales', 'forestales_nativos',
    'semilla_frijol', 'semilla_maiz', 'semilla_yuca', 'semilla_sandia',
    'semilla_ahuyama', 'semilla_cana', 'semilla_bore'
  )
);

alter table public.quarterly_progress
drop constraint if exists quarterly_progress_progress_type_check;

alter table public.quarterly_progress
add constraint quarterly_progress_progress_type_check
check (
  progress_type in (
    'avance',
    'entregados',
    'sembrados',
    'cumplimiento_acuerdo',
    'vegetal_entrega',
    'vegetal_siembra',
    'contrapartida_siembra'
  )
);

-- 'contrapartida_siembra' se comporta como los tipos vegetales: por familia, trimestre y grupo
-- (sin plan_activity_id).
alter table public.quarterly_progress
drop constraint if exists quarterly_progress_quarter_required;

alter table public.quarterly_progress
add constraint quarterly_progress_quarter_required
check (
  (progress_type = 'cumplimiento_acuerdo' and quarter is null)
  or (
    progress_type in ('vegetal_entrega', 'vegetal_siembra', 'contrapartida_siembra')
    and quarter is not null
    and vegetal_indicator_group is not null
  )
  or (
    progress_type not in ('cumplimiento_acuerdo', 'vegetal_entrega', 'vegetal_siembra', 'contrapartida_siembra')
    and quarter is not null
    and plan_activity_id is not null
  )
);

-- Unicidad del sembrado de contrapartida por proyecto, familia, año, trimestre y categoria.
create unique index if not exists quarterly_progress_contrapartida_siembra_unique
on public.quarterly_progress(project_id, family_id, year, quarter, vegetal_indicator_group)
where is_deleted = false and progress_type = 'contrapartida_siembra';

-- El trigger de validacion debe tratar 'contrapartida_siembra' igual que los tipos vegetales
-- (requiere grupo, no valida plan/actividad).
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

  if new.progress_type in ('vegetal_entrega', 'vegetal_siembra', 'contrapartida_siembra') then
    if new.vegetal_indicator_group is null then
      raise exception 'El avance de material vegetal requiere grupo vegetal.';
    end if;
    return new;
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

notify pgrst, 'reload schema';
