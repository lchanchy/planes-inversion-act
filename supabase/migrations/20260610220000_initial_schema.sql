-- Fase 1: base tecnica inicial Supabase/PostgreSQL.
-- Arquitectura: multi-proyecto, roles, asignaciones, auditoria, RLS y soporte offline-first.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.project_status as enum ('active', 'closed', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.record_status as enum ('active', 'inactive', 'retired');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.plan_status as enum (
    'draft',
    'ready_to_sync',
    'synced',
    'pending_material',
    'pending_review',
    'approved',
    'returned',
    'closed',
    'conflict'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.purchase_status as enum (
    'planned',
    'in_process',
    'purchased',
    'partially_delivered',
    'delivered',
    'closed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.delivery_status as enum ('pending', 'generated', 'printed', 'partially_delivered', 'delivered', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.material_resolution_status as enum ('pending', 'resolved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.indicator_light_status as enum ('none', 'low', 'medium', 'high', 'complete', 'exceeded_warning');
exception when duplicate_object then null;
end $$;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.users_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  document_number text,
  phone text,
  default_role_id uuid references public.roles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code_prefix text not null,
  department text,
  intervention_zone text,
  start_date date,
  end_date date,
  status public.project_status not null default 'active',
  next_family_number integer not null default 1 check (next_family_number > 0),
  logos jsonb not null default '[]'::jsonb,
  act_template_text jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint projects_code_prefix_unique unique (code_prefix),
  constraint projects_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.project_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users_profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  status public.record_status not null default 'active',
  can_approve_plans boolean not null default false,
  can_manage_purchases boolean not null default false,
  can_generate_documents boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint project_users_unique unique (project_id, user_id)
);

create table if not exists public.municipalities (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint municipalities_unique unique (department, name)
);

create table if not exists public.villages (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint villages_unique unique (municipality_id, name)
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_code text not null,
  representative_name text not null,
  document_number text,
  age integer check (age is null or age between 0 and 120),
  phone text,
  municipality_id uuid references public.municipalities(id) on delete restrict,
  village_id uuid references public.villages(id) on delete restrict,
  observations text,
  status public.record_status not null default 'active',
  validation_status text not null default 'validated' check (validation_status in ('temporary', 'pending_admin_validation', 'validated', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint families_project_code_unique unique (project_id, family_code),
  constraint families_project_document_unique unique (project_id, document_number)
);

create table if not exists public.family_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  technician_id uuid not null references public.users_profiles(id) on delete cascade,
  assigned_by uuid references public.users_profiles(id),
  assigned_at timestamptz not null default now(),
  status public.record_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint family_assignments_unique unique (family_id, technician_id)
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families(id) on delete cascade,
  property_name text,
  total_area_ha numeric(12,2) check (total_area_ha is null or total_area_ha >= 0),
  conservation_area_ha numeric(12,2) check (conservation_area_ha is null or conservation_area_ha >= 0),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.activity_catalog (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  category text,
  description text,
  unit text not null,
  indicator_type text,
  requires_baseline boolean not null default false,
  requires_target boolean not null default true,
  allows_project_materials boolean not null default true,
  allows_counterpart boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint activity_catalog_unique unique (project_id, name)
);

create table if not exists public.material_catalog (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  internal_code text,
  name text not null,
  category text,
  unit text not null,
  quoted_unit_price numeric(14,2) not null default 0 check (quoted_unit_price >= 0),
  price_updated_at date,
  active boolean not null default true,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint material_catalog_unique unique (project_id, name, category, unit)
);

create table if not exists public.provisional_materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by_profile_id uuid references public.users_profiles(id),
  provisional_name text not null,
  suggested_unit text not null,
  observation text,
  contribution_side text not null check (contribution_side in ('project', 'family_counterpart')),
  status public.material_resolution_status not null default 'pending',
  resolved_material_id uuid references public.material_catalog(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.operational_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  technician_id uuid references public.users_profiles(id),
  plan_date date not null default current_date,
  status public.plan_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  total_project_value numeric(14,2) not null default 0 check (total_project_value >= 0),
  total_counterpart_value numeric(14,2) not null default 0 check (total_counterpart_value >= 0),
  sync_status text not null default 'local' check (sync_status in ('local', 'pending_upload', 'synced', 'error', 'conflict')),
  local_created_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint operational_plans_one_active_version unique (project_id, family_id, version)
);

create table if not exists public.plan_activities (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.operational_plans(id) on delete cascade,
  activity_id uuid not null references public.activity_catalog(id) on delete restrict,
  baseline numeric(14,2),
  target numeric(14,2),
  unit text not null,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.plan_project_materials (
  id uuid primary key default gen_random_uuid(),
  plan_activity_id uuid not null references public.plan_activities(id) on delete cascade,
  material_id uuid references public.material_catalog(id) on delete restrict,
  provisional_material_id uuid references public.provisional_materials(id) on delete restrict,
  quantity numeric(14,2) not null check (quantity > 0),
  unit text not null,
  quoted_unit_price numeric(14,2) not null default 0 check (quoted_unit_price >= 0),
  quoted_total numeric(14,2) generated always as (quantity * quoted_unit_price) stored,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint plan_project_material_source_check check (
    (material_id is not null and provisional_material_id is null)
    or (material_id is null and provisional_material_id is not null)
  )
);

create table if not exists public.plan_family_counterparts (
  id uuid primary key default gen_random_uuid(),
  plan_activity_id uuid not null references public.plan_activities(id) on delete cascade,
  contribution_type text not null,
  name text not null,
  quantity numeric(14,2) not null check (quantity > 0),
  unit text not null,
  estimated_unit_value numeric(14,2) not null default 0 check (estimated_unit_value >= 0),
  estimated_total numeric(14,2) generated always as (quantity * estimated_unit_value) stored,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  purchase_number integer not null check (purchase_number > 0),
  name text not null,
  purchase_date date,
  status public.purchase_status not null default 'planned',
  supplier text,
  invoice_number text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint purchases_project_number_unique unique (project_id, purchase_number)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  material_id uuid not null references public.material_catalog(id) on delete restrict,
  required_quantity numeric(14,2) not null default 0 check (required_quantity >= 0),
  purchased_quantity numeric(14,2) not null default 0 check (purchased_quantity >= 0),
  real_unit_price numeric(14,2) not null default 0 check (real_unit_price >= 0),
  real_total numeric(14,2) generated always as (purchased_quantity * real_unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint purchase_items_unique unique (purchase_id, material_id)
);

create table if not exists public.purchase_family_allocations (
  id uuid primary key default gen_random_uuid(),
  purchase_item_id uuid not null references public.purchase_items(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete restrict,
  plan_project_material_id uuid references public.plan_project_materials(id) on delete restrict,
  allocated_quantity numeric(14,2) not null check (allocated_quantity > 0),
  delivered_quantity numeric(14,2) not null default 0 check (delivered_quantity >= 0),
  pending_quantity numeric(14,2) generated always as (allocated_quantity - delivered_quantity) stored,
  real_unit_price numeric(14,2) not null default 0 check (real_unit_price >= 0),
  real_total numeric(14,2) generated always as (allocated_quantity * real_unit_price) stored,
  status text not null default 'pending' check (status in ('pending', 'partial', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint delivered_not_over_allocated check (delivered_quantity <= allocated_quantity)
);

create table if not exists public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  delivery_date date not null default current_date,
  status public.delivery_status not null default 'pending',
  generated_pdf_path text,
  generated_word_path text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.delivery_record_items (
  id uuid primary key default gen_random_uuid(),
  delivery_record_id uuid not null references public.delivery_records(id) on delete cascade,
  purchase_family_allocation_id uuid not null references public.purchase_family_allocations(id) on delete restrict,
  material_id uuid not null references public.material_catalog(id) on delete restrict,
  description text not null,
  unit text not null,
  delivered_quantity numeric(14,2) not null check (delivered_quantity > 0),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.indicator_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer check (month is null or month between 1 and 12),
  quarter text check (quarter is null or quarter in ('T1', 'T2', 'T3', 'T4')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint indicator_period_dates_check check (end_date >= start_date),
  constraint indicator_periods_unique unique (project_id, year, month, quarter)
);

create table if not exists public.physical_indicators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  activity_id uuid not null references public.activity_catalog(id) on delete restrict,
  period_id uuid not null references public.indicator_periods(id) on delete restrict,
  baseline numeric(14,2) not null default 0,
  target numeric(14,2) not null default 0 check (target >= 0),
  progress numeric(14,2) not null default 0 check (progress >= 0),
  accumulated numeric(14,2) not null default 0 check (accumulated >= 0),
  progress_percent numeric(7,2) not null default 0,
  status_light public.indicator_light_status not null default 'none',
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint physical_indicators_unique unique (family_id, activity_id, period_id)
);

create table if not exists public.tree_indicators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  period_id uuid not null references public.indicator_periods(id) on delete restrict,
  tree_type text not null,
  delivered numeric(14,2) not null default 0 check (delivered >= 0),
  planted numeric(14,2) not null default 0 check (planted >= 0),
  accumulated_delivered numeric(14,2) not null default 0 check (accumulated_delivered >= 0),
  accumulated_planted numeric(14,2) not null default 0 check (accumulated_planted >= 0),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint tree_indicators_unique unique (family_id, period_id, tree_type)
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  type text not null check (type in ('delivery_record', 'report', 'other')),
  name text not null,
  content jsonb not null default '{}'::jsonb,
  storage_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  entity_type text not null,
  entity_id uuid not null,
  pdf_path text,
  word_path text,
  generated_by uuid references public.users_profiles(id),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users_profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users_profiles(id),
  device_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('started', 'success', 'partial', 'error')),
  details jsonb not null default '{}'::jsonb
);

create index if not exists idx_project_users_project on public.project_users(project_id);
create index if not exists idx_project_users_user on public.project_users(user_id);
create index if not exists idx_families_project on public.families(project_id);
create index if not exists idx_families_document on public.families(document_number);
create index if not exists idx_family_assignments_family on public.family_assignments(family_id);
create index if not exists idx_family_assignments_technician on public.family_assignments(technician_id);
create index if not exists idx_properties_family on public.properties(family_id);
create index if not exists idx_activity_catalog_project on public.activity_catalog(project_id);
create index if not exists idx_material_catalog_project on public.material_catalog(project_id);
create index if not exists idx_operational_plans_project_family on public.operational_plans(project_id, family_id);
create index if not exists idx_operational_plans_status on public.operational_plans(status);
create index if not exists idx_plan_activities_plan on public.plan_activities(plan_id);
create index if not exists idx_plan_project_materials_activity on public.plan_project_materials(plan_activity_id);
create index if not exists idx_purchases_project on public.purchases(project_id);
create index if not exists idx_purchase_items_purchase on public.purchase_items(purchase_id);
create index if not exists idx_purchase_allocations_family on public.purchase_family_allocations(family_id);
create index if not exists idx_delivery_records_project_family on public.delivery_records(project_id, family_id);
create index if not exists idx_physical_indicators_project_period on public.physical_indicators(project_id, period_id);
create index if not exists idx_audit_logs_project_entity on public.audit_logs(project_id, entity_type, entity_id);
create index if not exists idx_sync_logs_user_started on public.sync_logs(user_id, started_at desc);

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
    new.updated_by = coalesce(new.updated_by, auth.uid());
  elsif tg_op = 'UPDATE' then
    new.updated_at = now();
    new.updated_by = coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

create or replace function public.generate_family_code(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
  v_code text;
begin
  select code_prefix, next_family_number
    into v_prefix, v_next
  from public.projects
  where id = p_project_id and is_deleted = false
  for update;

  if v_prefix is null then
    raise exception 'Project % not found or inactive', p_project_id;
  end if;

  v_code := v_prefix || '-' || lpad(v_next::text, 4, '0');

  update public.projects
    set next_family_number = v_next + 1,
        updated_at = now(),
        updated_by = auth.uid()
  where id = p_project_id;

  return v_code;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users_profiles
  where auth_user_id = auth.uid()
    and active = true
    and is_deleted = false
  limit 1;
$$;

create or replace function public.has_project_role(p_project_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_users pu
    join public.roles r on r.id = pu.role_id
    where pu.project_id = p_project_id
      and pu.user_id = public.current_profile_id()
      and pu.status = 'active'
      and pu.is_deleted = false
      and r.name = any(p_roles)
      and r.is_deleted = false
  );
$$;

create or replace function public.has_default_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users_profiles up
    join public.roles r on r.id = up.default_role_id
    where up.auth_user_id = auth.uid()
      and up.active = true
      and up.is_deleted = false
      and r.name = any(p_roles)
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
  select exists (
    select 1
    from public.project_users pu
    where pu.project_id = p_project_id
      and pu.user_id = public.current_profile_id()
      and pu.status = 'active'
      and pu.is_deleted = false
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
        public.has_project_role(f.project_id, array['admin', 'coordinator', 'viewer', 'auditor'])
        or exists (
          select 1
          from public.family_assignments fa
          where fa.family_id = f.id
            and fa.technician_id = public.current_profile_id()
            and fa.status = 'active'
            and fa.is_deleted = false
        )
      )
  );
$$;

create or replace function public.recalculate_purchase_family_allocation(p_allocation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocated numeric(14,2);
  v_delivered numeric(14,2);
begin
  select allocated_quantity
    into v_allocated
  from public.purchase_family_allocations
  where id = p_allocation_id
  for update;

  if v_allocated is null then
    return;
  end if;

  select coalesce(sum(delivered_quantity), 0)
    into v_delivered
  from public.delivery_record_items
  where purchase_family_allocation_id = p_allocation_id
    and is_deleted = false;

  if v_delivered > v_allocated then
    raise exception 'Delivered quantity % exceeds allocated quantity % for allocation %',
      v_delivered, v_allocated, p_allocation_id;
  end if;

  update public.purchase_family_allocations
  set delivered_quantity = v_delivered,
      status = case
        when v_delivered = 0 then 'pending'
        when v_delivered < v_allocated then 'partial'
        else 'delivered'
      end,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_allocation_id;
end;
$$;

create or replace function public.sync_delivery_item_allocation()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalculate_purchase_family_allocation(old.purchase_family_allocation_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalculate_purchase_family_allocation(new.purchase_family_allocation_id);
    return new;
  end if;

  return old;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles','users_profiles','projects','project_users','municipalities','villages',
    'families','family_assignments','properties','activity_catalog','material_catalog',
    'provisional_materials','operational_plans','plan_activities','plan_project_materials',
    'plan_family_counterparts','purchases','purchase_items','purchase_family_allocations',
    'delivery_records','delivery_record_items','indicator_periods','physical_indicators',
    'tree_indicators','document_templates','generated_documents'
  ]
  loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format('create trigger trg_%I_audit before insert or update on public.%I for each row execute function public.set_audit_fields()', t, t);
  end loop;
end $$;

drop trigger if exists trg_delivery_items_sync_allocation on public.delivery_record_items;
create trigger trg_delivery_items_sync_allocation
after insert or update or delete on public.delivery_record_items
for each row execute function public.sync_delivery_item_allocation();

alter table public.roles enable row level security;
alter table public.users_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_users enable row level security;
alter table public.municipalities enable row level security;
alter table public.villages enable row level security;
alter table public.families enable row level security;
alter table public.family_assignments enable row level security;
alter table public.properties enable row level security;
alter table public.activity_catalog enable row level security;
alter table public.material_catalog enable row level security;
alter table public.provisional_materials enable row level security;
alter table public.operational_plans enable row level security;
alter table public.plan_activities enable row level security;
alter table public.plan_project_materials enable row level security;
alter table public.plan_family_counterparts enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.purchase_family_allocations enable row level security;
alter table public.delivery_records enable row level security;
alter table public.delivery_record_items enable row level security;
alter table public.indicator_periods enable row level security;
alter table public.physical_indicators enable row level security;
alter table public.tree_indicators enable row level security;
alter table public.document_templates enable row level security;
alter table public.generated_documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.sync_logs enable row level security;

drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
on public.roles for select
using (auth.uid() is not null);

drop policy if exists "roles_write_default_admin" on public.roles;
create policy "roles_write_default_admin"
on public.roles for all
using (public.has_default_role(array['admin']))
with check (public.has_default_role(array['admin']));

drop policy if exists "profiles_select_own_or_project_admin" on public.users_profiles;
create policy "profiles_select_own_or_project_admin"
on public.users_profiles for select
using (
  auth_user_id = auth.uid()
  or exists (
    select 1
    from public.project_users pu
    join public.roles r on r.id = pu.role_id
    where pu.user_id = public.current_profile_id()
      and r.name in ('admin', 'coordinator', 'auditor')
      and pu.status = 'active'
      and pu.is_deleted = false
  )
);

drop policy if exists "profiles_insert_own" on public.users_profiles;
create policy "profiles_insert_own"
on public.users_profiles for insert
with check (auth_user_id = auth.uid());

drop policy if exists "profiles_update_own_or_default_admin" on public.users_profiles;
create policy "profiles_update_own_or_default_admin"
on public.users_profiles for update
using (auth_user_id = auth.uid() or public.has_default_role(array['admin']))
with check (auth_user_id = auth.uid() or public.has_default_role(array['admin']));

drop policy if exists "projects_select_members" on public.projects;
create policy "projects_select_members"
on public.projects for select
using (public.is_project_member(id));

drop policy if exists "projects_insert_default_admin" on public.projects;
create policy "projects_insert_default_admin"
on public.projects for insert
with check (public.has_default_role(array['admin']));

drop policy if exists "projects_update_admins" on public.projects;
create policy "projects_update_admins"
on public.projects for update
using (public.has_project_role(id, array['admin']))
with check (public.has_project_role(id, array['admin']));

drop policy if exists "project_users_select_members" on public.project_users;
create policy "project_users_select_members"
on public.project_users for select
using (
  user_id = public.current_profile_id()
  or public.has_project_role(project_id, array['admin', 'coordinator', 'auditor'])
);

drop policy if exists "project_users_write_admins" on public.project_users;
create policy "project_users_write_admins"
on public.project_users for all
using (public.has_project_role(project_id, array['admin']))
with check (public.has_project_role(project_id, array['admin']));

drop policy if exists "municipalities_select_authenticated" on public.municipalities;
create policy "municipalities_select_authenticated"
on public.municipalities for select
using (auth.uid() is not null);

drop policy if exists "villages_select_authenticated" on public.villages;
create policy "villages_select_authenticated"
on public.villages for select
using (auth.uid() is not null);

drop policy if exists "families_select_by_project_or_assignment" on public.families;
create policy "families_select_by_project_or_assignment"
on public.families for select
using (public.can_access_family(id));

drop policy if exists "families_write_admin_coord" on public.families;
create policy "families_write_admin_coord"
on public.families for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "family_assignments_select_scoped" on public.family_assignments;
create policy "family_assignments_select_scoped"
on public.family_assignments for select
using (
  technician_id = public.current_profile_id()
  or public.has_project_role(project_id, array['admin', 'coordinator', 'auditor'])
);

drop policy if exists "family_assignments_write_admin_coord" on public.family_assignments;
create policy "family_assignments_write_admin_coord"
on public.family_assignments for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "properties_select_family_scope" on public.properties;
create policy "properties_select_family_scope"
on public.properties for select
using (public.can_access_family(family_id));

drop policy if exists "properties_write_family_scope" on public.properties;
create policy "properties_write_family_scope"
on public.properties for all
using (
  public.can_access_family(family_id)
  and exists (
    select 1 from public.families f
    where f.id = family_id
      and (
        public.has_project_role(f.project_id, array['admin', 'coordinator'])
        or exists (
          select 1 from public.family_assignments fa
          where fa.family_id = f.id
            and fa.technician_id = public.current_profile_id()
            and fa.status = 'active'
            and fa.is_deleted = false
        )
      )
  )
)
with check (public.can_access_family(family_id));

drop policy if exists "activity_catalog_select_members" on public.activity_catalog;
create policy "activity_catalog_select_members"
on public.activity_catalog for select
using (project_id is null or public.is_project_member(project_id));

drop policy if exists "activity_catalog_write_admin_coord" on public.activity_catalog;
create policy "activity_catalog_write_admin_coord"
on public.activity_catalog for all
using (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']))
with check (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "material_catalog_select_members" on public.material_catalog;
create policy "material_catalog_select_members"
on public.material_catalog for select
using (project_id is null or public.is_project_member(project_id));

drop policy if exists "material_catalog_write_admin_coord" on public.material_catalog;
create policy "material_catalog_write_admin_coord"
on public.material_catalog for all
using (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']))
with check (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "provisional_materials_select_members" on public.provisional_materials;
create policy "provisional_materials_select_members"
on public.provisional_materials for select
using (public.is_project_member(project_id));

drop policy if exists "provisional_materials_insert_members" on public.provisional_materials;
create policy "provisional_materials_insert_members"
on public.provisional_materials for insert
with check (public.is_project_member(project_id));

drop policy if exists "provisional_materials_resolve_admin_coord" on public.provisional_materials;
create policy "provisional_materials_resolve_admin_coord"
on public.provisional_materials for update
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "plans_select_family_scope" on public.operational_plans;
create policy "plans_select_family_scope"
on public.operational_plans for select
using (public.can_access_family(family_id));

drop policy if exists "plans_insert_family_scope" on public.operational_plans;
create policy "plans_insert_family_scope"
on public.operational_plans for insert
with check (
  public.can_access_family(family_id)
  and status in ('draft', 'ready_to_sync', 'synced', 'pending_material', 'pending_review')
);

drop policy if exists "plans_update_no_mobile_approved" on public.operational_plans;
create policy "plans_update_no_mobile_approved"
on public.operational_plans for update
using (
  public.can_access_family(family_id)
  and (
    public.has_project_role(project_id, array['admin', 'coordinator'])
    or status in ('draft', 'ready_to_sync', 'synced', 'pending_material', 'pending_review', 'returned', 'conflict')
  )
)
with check (
  public.can_access_family(family_id)
  and (
    public.has_project_role(project_id, array['admin', 'coordinator'])
    or status in ('draft', 'ready_to_sync', 'synced', 'pending_material', 'pending_review', 'returned')
  )
);

drop policy if exists "plan_activities_select_plan_scope" on public.plan_activities;
create policy "plan_activities_select_plan_scope"
on public.plan_activities for select
using (exists (select 1 from public.operational_plans p where p.id = plan_id and public.can_access_family(p.family_id)));

drop policy if exists "plan_activities_write_plan_scope" on public.plan_activities;
create policy "plan_activities_write_plan_scope"
on public.plan_activities for all
using (exists (
  select 1 from public.operational_plans p
  where p.id = plan_id
    and public.can_access_family(p.family_id)
    and (public.has_project_role(p.project_id, array['admin', 'coordinator']) or p.status in ('draft', 'returned', 'pending_material', 'pending_review'))
))
with check (exists (
  select 1 from public.operational_plans p
  where p.id = plan_id
    and public.can_access_family(p.family_id)
  and (public.has_project_role(p.project_id, array['admin', 'coordinator']) or p.status in ('draft', 'returned', 'pending_material', 'pending_review'))
));

drop policy if exists "plan_materials_select_plan_scope" on public.plan_project_materials;
create policy "plan_materials_select_plan_scope"
on public.plan_project_materials for select
using (exists (
  select 1
  from public.plan_activities pa
  join public.operational_plans p on p.id = pa.plan_id
  where pa.id = plan_activity_id and public.can_access_family(p.family_id)
));

drop policy if exists "plan_materials_write_plan_scope" on public.plan_project_materials;
create policy "plan_materials_write_plan_scope"
on public.plan_project_materials for all
using (exists (
  select 1
  from public.plan_activities pa
  join public.operational_plans p on p.id = pa.plan_id
  where pa.id = plan_activity_id
    and public.can_access_family(p.family_id)
    and (public.has_project_role(p.project_id, array['admin', 'coordinator']) or p.status in ('draft', 'returned', 'pending_material', 'pending_review'))
))
with check (exists (
  select 1
  from public.plan_activities pa
  join public.operational_plans p on p.id = pa.plan_id
  where pa.id = plan_activity_id
    and public.can_access_family(p.family_id)
    and (public.has_project_role(p.project_id, array['admin', 'coordinator']) or p.status in ('draft', 'returned', 'pending_material', 'pending_review'))
));

drop policy if exists "counterparts_select_plan_scope" on public.plan_family_counterparts;
create policy "counterparts_select_plan_scope"
on public.plan_family_counterparts for select
using (exists (
  select 1
  from public.plan_activities pa
  join public.operational_plans p on p.id = pa.plan_id
  where pa.id = plan_activity_id and public.can_access_family(p.family_id)
));

drop policy if exists "counterparts_write_plan_scope" on public.plan_family_counterparts;
create policy "counterparts_write_plan_scope"
on public.plan_family_counterparts for all
using (exists (
  select 1
  from public.plan_activities pa
  join public.operational_plans p on p.id = pa.plan_id
  where pa.id = plan_activity_id
    and public.can_access_family(p.family_id)
    and (public.has_project_role(p.project_id, array['admin', 'coordinator']) or p.status in ('draft', 'returned', 'pending_material', 'pending_review'))
))
with check (exists (
  select 1
  from public.plan_activities pa
  join public.operational_plans p on p.id = pa.plan_id
  where pa.id = plan_activity_id
    and public.can_access_family(p.family_id)
    and (public.has_project_role(p.project_id, array['admin', 'coordinator']) or p.status in ('draft', 'returned', 'pending_material', 'pending_review'))
));

drop policy if exists "purchases_select_members" on public.purchases;
create policy "purchases_select_members"
on public.purchases for select
using (public.is_project_member(project_id));

drop policy if exists "purchases_write_admin_coord_purchase" on public.purchases;
create policy "purchases_write_admin_coord_purchase"
on public.purchases for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "purchase_items_select_members" on public.purchase_items;
create policy "purchase_items_select_members"
on public.purchase_items for select
using (exists (select 1 from public.purchases p where p.id = purchase_id and public.is_project_member(p.project_id)));

drop policy if exists "purchase_items_write_admin_coord" on public.purchase_items;
create policy "purchase_items_write_admin_coord"
on public.purchase_items for all
using (exists (select 1 from public.purchases p where p.id = purchase_id and public.has_project_role(p.project_id, array['admin', 'coordinator'])))
with check (exists (select 1 from public.purchases p where p.id = purchase_id and public.has_project_role(p.project_id, array['admin', 'coordinator'])));

drop policy if exists "purchase_allocations_select_scoped" on public.purchase_family_allocations;
create policy "purchase_allocations_select_scoped"
on public.purchase_family_allocations for select
using (public.can_access_family(family_id));

drop policy if exists "purchase_allocations_write_admin_coord" on public.purchase_family_allocations;
create policy "purchase_allocations_write_admin_coord"
on public.purchase_family_allocations for all
using (exists (
  select 1 from public.purchase_items pi
  join public.purchases p on p.id = pi.purchase_id
  where pi.id = purchase_item_id and public.has_project_role(p.project_id, array['admin', 'coordinator'])
))
with check (exists (
  select 1 from public.purchase_items pi
  join public.purchases p on p.id = pi.purchase_id
  where pi.id = purchase_item_id and public.has_project_role(p.project_id, array['admin', 'coordinator'])
));

drop policy if exists "delivery_records_select_scoped" on public.delivery_records;
create policy "delivery_records_select_scoped"
on public.delivery_records for select
using (public.can_access_family(family_id));

drop policy if exists "delivery_records_write_admin_coord" on public.delivery_records;
create policy "delivery_records_write_admin_coord"
on public.delivery_records for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "delivery_items_select_scoped" on public.delivery_record_items;
create policy "delivery_items_select_scoped"
on public.delivery_record_items for select
using (exists (
  select 1 from public.delivery_records dr
  where dr.id = delivery_record_id and public.can_access_family(dr.family_id)
));

drop policy if exists "delivery_items_write_admin_coord" on public.delivery_record_items;
create policy "delivery_items_write_admin_coord"
on public.delivery_record_items for all
using (exists (
  select 1 from public.delivery_records dr
  where dr.id = delivery_record_id and public.has_project_role(dr.project_id, array['admin', 'coordinator'])
))
with check (exists (
  select 1 from public.delivery_records dr
  where dr.id = delivery_record_id and public.has_project_role(dr.project_id, array['admin', 'coordinator'])
));

drop policy if exists "indicator_periods_select_members" on public.indicator_periods;
create policy "indicator_periods_select_members"
on public.indicator_periods for select
using (public.is_project_member(project_id));

drop policy if exists "indicator_periods_write_admin_coord" on public.indicator_periods;
create policy "indicator_periods_write_admin_coord"
on public.indicator_periods for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "physical_indicators_select_scoped" on public.physical_indicators;
create policy "physical_indicators_select_scoped"
on public.physical_indicators for select
using (public.can_access_family(family_id));

drop policy if exists "physical_indicators_write_scoped" on public.physical_indicators;
create policy "physical_indicators_write_scoped"
on public.physical_indicators for all
using (public.can_access_family(family_id))
with check (public.can_access_family(family_id));

drop policy if exists "tree_indicators_select_scoped" on public.tree_indicators;
create policy "tree_indicators_select_scoped"
on public.tree_indicators for select
using (public.can_access_family(family_id));

drop policy if exists "tree_indicators_write_scoped" on public.tree_indicators;
create policy "tree_indicators_write_scoped"
on public.tree_indicators for all
using (public.can_access_family(family_id))
with check (public.can_access_family(family_id));

drop policy if exists "document_templates_select_members" on public.document_templates;
create policy "document_templates_select_members"
on public.document_templates for select
using (project_id is null or public.is_project_member(project_id));

drop policy if exists "document_templates_write_admin_coord" on public.document_templates;
create policy "document_templates_write_admin_coord"
on public.document_templates for all
using (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']))
with check (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "generated_documents_select_members" on public.generated_documents;
create policy "generated_documents_select_members"
on public.generated_documents for select
using (public.is_project_member(project_id));

drop policy if exists "generated_documents_write_admin_coord" on public.generated_documents;
create policy "generated_documents_write_admin_coord"
on public.generated_documents for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "audit_logs_select_admin_coord_auditor" on public.audit_logs;
create policy "audit_logs_select_admin_coord_auditor"
on public.audit_logs for select
using (project_id is null or public.has_project_role(project_id, array['admin', 'coordinator', 'auditor']));

drop policy if exists "sync_logs_own" on public.sync_logs;
create policy "sync_logs_own"
on public.sync_logs for all
using (user_id = public.current_profile_id())
with check (user_id = public.current_profile_id());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.generate_family_code(uuid) to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_project_role(uuid, text[]) to authenticated;
grant execute on function public.has_default_role(text[]) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_access_family(uuid) to authenticated;
