-- Fase 5: compras/adquisiciones, entregas de materiales y actas.
-- No modifica migraciones anteriores; agrega tablas nuevas separadas.

create table if not exists public.procurement_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  batch_code text not null,
  name text not null,
  status text not null default 'pendiente_compra'
    check (status in ('pendiente_compra', 'en_proceso', 'comprado', 'entregado_parcial', 'entregado_total', 'cancelado')),
  filter_project_id uuid references public.projects(id) on delete set null,
  filter_municipality_id uuid references public.municipalities(id) on delete set null,
  filter_village_id uuid references public.villages(id) on delete set null,
  filter_family_id uuid references public.families(id) on delete set null,
  filter_activity_id uuid references public.activity_catalog(id) on delete set null,
  filter_material_id uuid references public.material_catalog(id) on delete set null,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint procurement_batches_project_code_unique unique (project_id, batch_code)
);

create table if not exists public.procurement_batch_items (
  id uuid primary key default gen_random_uuid(),
  procurement_batch_id uuid not null references public.procurement_batches(id) on delete cascade,
  material_id uuid references public.material_catalog(id) on delete restrict,
  provisional_material_id uuid references public.provisional_materials(id) on delete restrict,
  material_name text not null,
  unit text not null,
  required_quantity numeric(14,2) not null check (required_quantity > 0),
  purchased_quantity numeric(14,2) not null default 0 check (purchased_quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  total_value numeric(14,2) generated always as (required_quantity * unit_price) stored,
  status text not null default 'pendiente_compra'
    check (status in ('pendiente_compra', 'en_proceso', 'comprado', 'entregado_parcial', 'entregado_total', 'cancelado')),
  source_plan_material_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint procurement_batch_item_material_source check (material_id is not null or provisional_material_id is not null or material_name <> '')
);

create table if not exists public.material_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  operational_plan_id uuid not null references public.operational_plans(id) on delete restrict,
  delivery_date date not null default current_date,
  status text not null default 'entregado_parcial'
    check (status in ('entregado_parcial', 'entregado_total', 'cancelado')),
  observations text,
  registered_by uuid references public.users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.material_delivery_items (
  id uuid primary key default gen_random_uuid(),
  material_delivery_id uuid not null references public.material_deliveries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  operational_plan_id uuid not null references public.operational_plans(id) on delete restrict,
  plan_activity_id uuid not null references public.plan_activities(id) on delete restrict,
  activity_id uuid references public.activity_catalog(id) on delete restrict,
  plan_project_material_id uuid not null references public.plan_project_materials(id) on delete restrict,
  material_id uuid references public.material_catalog(id) on delete restrict,
  provisional_material_id uuid references public.provisional_materials(id) on delete restrict,
  material_name text not null,
  unit text not null,
  approved_quantity numeric(14,2) not null check (approved_quantity > 0),
  delivered_quantity numeric(14,2) not null check (delivered_quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  total_value numeric(14,2) generated always as (delivered_quantity * unit_price) stored,
  observations text,
  admin_override boolean not null default false,
  override_authorized_by uuid references public.users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.delivery_acts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  operational_plan_id uuid not null references public.operational_plans(id) on delete restrict,
  material_delivery_id uuid not null references public.material_deliveries(id) on delete restrict,
  act_number text not null,
  status text not null default 'generated' check (status in ('generated', 'signed', 'void')),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.users_profiles(id),
  pdf_path text,
  word_path text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint delivery_acts_delivery_unique unique (material_delivery_id, act_number)
);

create index if not exists idx_procurement_batches_project on public.procurement_batches(project_id);
create index if not exists idx_procurement_batches_status on public.procurement_batches(status);
create index if not exists idx_procurement_batch_items_batch on public.procurement_batch_items(procurement_batch_id);
create index if not exists idx_procurement_batch_items_material on public.procurement_batch_items(material_id);
create index if not exists idx_material_deliveries_project_family on public.material_deliveries(project_id, family_id);
create index if not exists idx_material_deliveries_plan on public.material_deliveries(operational_plan_id);
create index if not exists idx_material_delivery_items_delivery on public.material_delivery_items(material_delivery_id);
create index if not exists idx_material_delivery_items_plan_material on public.material_delivery_items(plan_project_material_id);
create index if not exists idx_delivery_acts_project_family on public.delivery_acts(project_id, family_id);
create index if not exists idx_delivery_acts_delivery on public.delivery_acts(material_delivery_id);

drop trigger if exists set_audit_procurement_batches on public.procurement_batches;
create trigger set_audit_procurement_batches
before insert or update on public.procurement_batches
for each row execute function public.set_audit_fields();

drop trigger if exists set_audit_procurement_batch_items on public.procurement_batch_items;
create trigger set_audit_procurement_batch_items
before insert or update on public.procurement_batch_items
for each row execute function public.set_audit_fields();

drop trigger if exists set_audit_material_deliveries on public.material_deliveries;
create trigger set_audit_material_deliveries
before insert or update on public.material_deliveries
for each row execute function public.set_audit_fields();

drop trigger if exists set_audit_material_delivery_items on public.material_delivery_items;
create trigger set_audit_material_delivery_items
before insert or update on public.material_delivery_items
for each row execute function public.set_audit_fields();

drop trigger if exists set_audit_delivery_acts on public.delivery_acts;
create trigger set_audit_delivery_acts
before insert or update on public.delivery_acts
for each row execute function public.set_audit_fields();

create or replace function public.validate_phase5_material_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
begin
  select p.id, p.project_id, p.family_id, p.status
  into v_plan
  from public.operational_plans p
  where p.id = new.operational_plan_id
    and p.is_deleted = false;

  if not found then
    raise exception 'El plan operativo no existe o fue eliminado.';
  end if;

  if v_plan.status <> 'approved' then
    raise exception 'Solo se pueden registrar entregas desde planes operativos aprobados.';
  end if;

  if new.project_id <> v_plan.project_id or new.family_id <> v_plan.family_id then
    raise exception 'La entrega no coincide con el proyecto/familia del plan operativo.';
  end if;

  new.registered_by = coalesce(new.registered_by, public.current_profile_id());
  return new;
end;
$$;

create or replace function public.validate_phase5_material_delivery_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_material record;
  v_total_delivered numeric(14,2);
begin
  select d.id, d.project_id, d.family_id, d.operational_plan_id
  into v_delivery
  from public.material_deliveries d
  where d.id = new.material_delivery_id
    and d.is_deleted = false;

  if not found then
    raise exception 'La entrega no existe o fue eliminada.';
  end if;

  select ppm.id,
         ppm.plan_activity_id,
         ppm.material_id,
         ppm.provisional_material_id,
         ppm.quantity,
         ppm.unit,
         ppm.quoted_unit_price,
         pa.plan_id,
         pa.activity_id
  into v_material
  from public.plan_project_materials ppm
  join public.plan_activities pa on pa.id = ppm.plan_activity_id
  where ppm.id = new.plan_project_material_id
    and ppm.is_deleted = false
    and pa.is_deleted = false;

  if not found then
    raise exception 'El material aprobado del plan no existe o fue eliminado.';
  end if;

  if v_material.plan_id <> v_delivery.operational_plan_id then
    raise exception 'El material no pertenece al plan operativo de la entrega.';
  end if;

  new.project_id = v_delivery.project_id;
  new.family_id = v_delivery.family_id;
  new.operational_plan_id = v_delivery.operational_plan_id;
  new.plan_activity_id = v_material.plan_activity_id;
  new.activity_id = v_material.activity_id;
  new.material_id = v_material.material_id;
  new.provisional_material_id = v_material.provisional_material_id;
  new.approved_quantity = v_material.quantity;
  new.unit = v_material.unit;
  new.unit_price = v_material.quoted_unit_price;

  select coalesce(sum(i.delivered_quantity), 0)
  into v_total_delivered
  from public.material_delivery_items i
  where i.plan_project_material_id = new.plan_project_material_id
    and i.is_deleted = false
    and (tg_op = 'INSERT' or i.id <> new.id);

  if v_total_delivered + new.delivered_quantity > v_material.quantity then
    if not new.admin_override then
      raise exception 'La cantidad entregada supera la cantidad aprobada.';
    end if;
    if not public.has_project_role(v_delivery.project_id, array['admin']) then
      raise exception 'Solo un administrador puede autorizar una entrega superior a la aprobada.';
    end if;
    new.override_authorized_by = coalesce(new.override_authorized_by, public.current_profile_id());
  end if;

  return new;
end;
$$;

create or replace function public.validate_phase5_delivery_act()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_items integer;
begin
  select id, project_id, family_id, operational_plan_id
  into v_delivery
  from public.material_deliveries
  where id = new.material_delivery_id
    and is_deleted = false;

  if not found then
    raise exception 'No se puede generar acta sin entrega registrada.';
  end if;

  select count(*)
  into v_items
  from public.material_delivery_items
  where material_delivery_id = new.material_delivery_id
    and is_deleted = false;

  if v_items = 0 then
    raise exception 'No se puede generar acta sin items entregados.';
  end if;

  new.project_id = v_delivery.project_id;
  new.family_id = v_delivery.family_id;
  new.operational_plan_id = v_delivery.operational_plan_id;
  new.generated_by = coalesce(new.generated_by, public.current_profile_id());
  return new;
end;
$$;

drop trigger if exists validate_phase5_material_deliveries on public.material_deliveries;
create trigger validate_phase5_material_deliveries
before insert or update on public.material_deliveries
for each row execute function public.validate_phase5_material_delivery();

drop trigger if exists validate_phase5_material_delivery_items on public.material_delivery_items;
create trigger validate_phase5_material_delivery_items
before insert or update on public.material_delivery_items
for each row execute function public.validate_phase5_material_delivery_item();

drop trigger if exists validate_phase5_delivery_acts on public.delivery_acts;
create trigger validate_phase5_delivery_acts
before insert or update on public.delivery_acts
for each row execute function public.validate_phase5_delivery_act();

alter table public.procurement_batches enable row level security;
alter table public.procurement_batch_items enable row level security;
alter table public.material_deliveries enable row level security;
alter table public.material_delivery_items enable row level security;
alter table public.delivery_acts enable row level security;

drop policy if exists "procurement_batches_select_members" on public.procurement_batches;
create policy "procurement_batches_select_members"
on public.procurement_batches for select
using (public.is_project_member(project_id));

drop policy if exists "procurement_batches_write_admin_coord" on public.procurement_batches;
create policy "procurement_batches_write_admin_coord"
on public.procurement_batches for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "procurement_batch_items_select_members" on public.procurement_batch_items;
create policy "procurement_batch_items_select_members"
on public.procurement_batch_items for select
using (exists (
  select 1 from public.procurement_batches b
  where b.id = procurement_batch_id
    and public.is_project_member(b.project_id)
));

drop policy if exists "procurement_batch_items_write_admin_coord" on public.procurement_batch_items;
create policy "procurement_batch_items_write_admin_coord"
on public.procurement_batch_items for all
using (exists (
  select 1 from public.procurement_batches b
  where b.id = procurement_batch_id
    and public.has_project_role(b.project_id, array['admin', 'coordinator'])
))
with check (exists (
  select 1 from public.procurement_batches b
  where b.id = procurement_batch_id
    and public.has_project_role(b.project_id, array['admin', 'coordinator'])
));

drop policy if exists "material_deliveries_select_scoped" on public.material_deliveries;
create policy "material_deliveries_select_scoped"
on public.material_deliveries for select
using (public.can_access_family(family_id));

drop policy if exists "material_deliveries_insert_scoped" on public.material_deliveries;
create policy "material_deliveries_insert_scoped"
on public.material_deliveries for insert
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

drop policy if exists "material_deliveries_update_admin_coord" on public.material_deliveries;
create policy "material_deliveries_update_admin_coord"
on public.material_deliveries for update
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "material_delivery_items_select_scoped" on public.material_delivery_items;
create policy "material_delivery_items_select_scoped"
on public.material_delivery_items for select
using (public.can_access_family(family_id));

drop policy if exists "material_delivery_items_insert_scoped" on public.material_delivery_items;
create policy "material_delivery_items_insert_scoped"
on public.material_delivery_items for insert
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id))
);

drop policy if exists "material_delivery_items_update_admin_coord" on public.material_delivery_items;
create policy "material_delivery_items_update_admin_coord"
on public.material_delivery_items for update
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

drop policy if exists "delivery_acts_select_scoped" on public.delivery_acts;
create policy "delivery_acts_select_scoped"
on public.delivery_acts for select
using (public.can_access_family(family_id));

drop policy if exists "delivery_acts_write_admin_coord" on public.delivery_acts;
create policy "delivery_acts_write_admin_coord"
on public.delivery_acts for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

grant select, insert, update on public.procurement_batches to authenticated;
grant select, insert, update on public.procurement_batch_items to authenticated;
grant select, insert, update on public.material_deliveries to authenticated;
grant select, insert, update on public.material_delivery_items to authenticated;
grant select, insert, update on public.delivery_acts to authenticated;

notify pgrst, 'reload schema';
