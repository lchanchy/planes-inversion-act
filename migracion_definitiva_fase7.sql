-- CONSOLIDADO DE MIGRACIONES FALTANTES FASE 7

-- MIGRATION: 20260618100000_phase7_tracking_matrix.sql
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


-- MIGRATION: 20260619100000_phase7_purchase_invoice_values.sql
-- Fase 7: datos reales de factura y compra.
-- Amplia tablas de Fase 5 sin modificar migraciones ya validadas.

alter table public.procurement_batches
  add column if not exists purchase_number integer,
  add column if not exists supplier_name text,
  add column if not exists invoice_number text,
  add column if not exists invoice_date date,
  add column if not exists purchase_observations text;

alter table public.procurement_batch_items
  add column if not exists quoted_unit_price numeric(14,2),
  add column if not exists quoted_total_value numeric(14,2),
  add column if not exists invoice_quantity numeric(14,2) default 0 check (invoice_quantity >= 0),
  add column if not exists purchase_unit_price numeric(14,2) default 0 check (purchase_unit_price >= 0),
  add column if not exists purchase_total_value numeric(14,2) default 0 check (purchase_total_value >= 0);

update public.procurement_batch_items
set
  quoted_unit_price = coalesce(quoted_unit_price, unit_price),
  quoted_total_value = coalesce(quoted_total_value, required_quantity * unit_price)
where quoted_unit_price is null
   or quoted_total_value is null;

with numbered as (
  select
    id,
    row_number() over (partition by project_id order by created_at, id) as generated_number
  from public.procurement_batches
  where purchase_number is null
)
update public.procurement_batches batch
set purchase_number = numbered.generated_number
from numbered
where batch.id = numbered.id;

create index if not exists idx_procurement_batches_project_purchase_number
on public.procurement_batches(project_id, purchase_number);

create index if not exists idx_procurement_batches_invoice_number
on public.procurement_batches(invoice_number);


-- MIGRATION: 20260620100000_phase7_etec_material_specs.sql
alter table public.material_catalog
  add column if not exists etec_block text,
  add column if not exists technical_characteristics text;

alter table public.procurement_batch_items
  add column if not exists etec_block text,
  add column if not exists technical_characteristics text;

create index if not exists idx_material_catalog_etec_block
  on public.material_catalog (project_id, etec_block)
  where is_deleted = false;

notify pgrst, 'reload schema';


-- MIGRATION: 20260620130000_phase7_vegetal_indicators.sql
-- Fase 7: clasificacion de material vegetal e indicadores trimestrales por grupo.
-- Migracion nueva; no modifica migraciones anteriores validadas.

alter table public.material_catalog
add column if not exists vegetal_indicator_group text;

alter table public.material_catalog
drop constraint if exists material_catalog_vegetal_indicator_group_check;

alter table public.material_catalog
add constraint material_catalog_vegetal_indicator_group_check
check (
  vegetal_indicator_group is null
  or vegetal_indicator_group in ('colinos', 'cacao', 'frutales', 'forestales_nativos', 'otro')
);

alter table public.quarterly_progress
add column if not exists vegetal_indicator_group text;

alter table public.quarterly_progress
drop constraint if exists quarterly_progress_vegetal_indicator_group_check;

alter table public.quarterly_progress
add constraint quarterly_progress_vegetal_indicator_group_check
check (
  vegetal_indicator_group is null
  or vegetal_indicator_group in ('colinos', 'cacao', 'frutales', 'forestales_nativos')
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
    'vegetal_siembra'
  )
);

alter table public.quarterly_progress
drop constraint if exists quarterly_progress_quarter_required;

alter table public.quarterly_progress
add constraint quarterly_progress_quarter_required
check (
  (progress_type = 'cumplimiento_acuerdo' and quarter is null)
  or (
    progress_type in ('vegetal_entrega', 'vegetal_siembra')
    and quarter is not null
    and vegetal_indicator_group is not null
  )
  or (
    progress_type not in ('cumplimiento_acuerdo', 'vegetal_entrega', 'vegetal_siembra')
    and quarter is not null
    and plan_activity_id is not null
  )
);

create unique index if not exists quarterly_progress_vegetal_unique
on public.quarterly_progress(project_id, family_id, year, quarter, progress_type, vegetal_indicator_group)
where is_deleted = false and progress_type in ('vegetal_entrega', 'vegetal_siembra');

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

  if new.progress_type in ('vegetal_entrega', 'vegetal_siembra') then
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


-- MIGRATION: 20260620150000_phase7_web_plan_editor_counterpart_vegetal.sql
-- Fase 7: edicion web de planes y material vegetal de contrapartida familiar.
-- Migracion nueva; no modifica migraciones anteriores validadas.

alter table public.plan_family_counterparts
add column if not exists vegetal_indicator_group text;

alter table public.plan_family_counterparts
drop constraint if exists plan_family_counterparts_vegetal_group_check;

alter table public.plan_family_counterparts
add constraint plan_family_counterparts_vegetal_group_check
check (
  vegetal_indicator_group is null
  or vegetal_indicator_group in ('colinos', 'cacao', 'frutales', 'forestales_nativos', 'otro')
);

notify pgrst, 'reload schema';


-- MIGRATION: 20260620170000_phase7_activity_restoration_strategy.sql
alter table public.activity_catalog
add column if not exists restoration_strategy text not null default 'no_aplica';

alter table public.activity_catalog
drop constraint if exists activity_catalog_restoration_strategy_check;

alter table public.activity_catalog
add constraint activity_catalog_restoration_strategy_check
check (restoration_strategy in (
  'restauracion_ecologica',
  'rehabilitacion_ecologica',
  'recuperacion_ecologica',
  'no_aplica'
));

create index if not exists idx_activity_catalog_restoration_strategy
on public.activity_catalog(restoration_strategy)
where is_deleted = false;


-- MIGRATION: 20260622190000_phase7_maintenance_tool.sql
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


-- MIGRATION: 20260622200000_phase7_maintenance_abonos_global.sql
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


-- MIGRATION: 20260622210000_user_roles_municipal_scope.sql
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


