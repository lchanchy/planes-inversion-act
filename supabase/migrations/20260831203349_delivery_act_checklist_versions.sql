-- Checklist transaccional y versionado de actas de entrega por familia.
alter table public.delivery_acts
  add column if not exists act_sequence integer,
  add column if not exists version integer not null default 1,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.users_profiles(id);

update public.delivery_acts a
set act_sequence = numbered.sequence
from (
  select id, row_number() over (partition by family_id order by generated_at, id)::integer as sequence
  from public.delivery_acts
) numbered
where a.id = numbered.id and a.act_sequence is null;

alter table public.delivery_acts
  alter column act_sequence set not null,
  add constraint delivery_acts_sequence_positive check (act_sequence > 0),
  add constraint delivery_acts_version_positive check (version > 0);

create unique index if not exists delivery_acts_family_sequence_unique
on public.delivery_acts(family_id, act_sequence);

create table if not exists public.delivery_act_versions (
  id uuid primary key default gen_random_uuid(),
  delivery_act_id uuid not null references public.delivery_acts(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null check (status in ('generated', 'signed', 'void')),
  delivery_date date not null,
  observations text,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint delivery_act_versions_unique unique (delivery_act_id, version)
);

create index if not exists idx_delivery_act_versions_family_act
on public.delivery_act_versions(family_id, delivery_act_id, version desc);

insert into public.delivery_act_versions(delivery_act_id,project_id,family_id,version,status,delivery_date,observations,items)
select a.id,a.project_id,a.family_id,1,a.status,d.delivery_date,a.observations,
  jsonb_agg(to_jsonb(i) order by i.material_name,i.id)
from public.delivery_acts a
join public.material_deliveries d on d.id=a.material_delivery_id
join public.material_delivery_items i on i.material_delivery_id=d.id and not i.is_deleted
group by a.id,a.project_id,a.family_id,a.status,d.delivery_date,a.observations
on conflict (delivery_act_id,version) do nothing;

alter table public.delivery_act_versions enable row level security;
create policy "delivery_act_versions_select_scoped" on public.delivery_act_versions
for select to authenticated using (public.can_access_family(family_id));
create policy "delivery_act_versions_insert_act_roles" on public.delivery_act_versions
for insert to authenticated with check (
  public.has_project_role(project_id,array['admin','coordinator'])
  or (public.has_project_role(project_id,array['technician']) and public.can_access_family(family_id))
);
grant select,insert on public.delivery_act_versions to authenticated;

create or replace function public.validate_phase5_delivery_act()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_delivery record; v_items integer;
begin
  select id, project_id, family_id, operational_plan_id into v_delivery
  from public.material_deliveries where id = new.material_delivery_id and is_deleted = false;
  if not found then raise exception 'No se puede generar acta sin entrega registrada.'; end if;
  if new.status <> 'void' then
    select count(*) into v_items from public.material_delivery_items
    where material_delivery_id = new.material_delivery_id and is_deleted = false;
    if v_items = 0 then raise exception 'No se puede generar acta sin items entregados.'; end if;
  end if;
  new.project_id = v_delivery.project_id;
  new.family_id = v_delivery.family_id;
  new.operational_plan_id = v_delivery.operational_plan_id;
  new.generated_by = coalesce(new.generated_by, public.current_profile_id());
  return new;
end $$;

drop policy if exists "material_deliveries_update_admin_coord" on public.material_deliveries;
create policy "material_deliveries_update_act_roles" on public.material_deliveries for update to authenticated
using (public.has_project_role(project_id, array['admin','coordinator']) or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id)))
with check (public.has_project_role(project_id, array['admin','coordinator']) or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id)));

drop policy if exists "material_delivery_items_update_admin_coord" on public.material_delivery_items;
create policy "material_delivery_items_update_act_roles" on public.material_delivery_items for update to authenticated
using (public.has_project_role(project_id, array['admin','coordinator']) or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id)))
with check (public.has_project_role(project_id, array['admin','coordinator']) or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id)));

drop policy if exists "delivery_acts_write_admin_coord" on public.delivery_acts;
create policy "delivery_acts_write_act_roles" on public.delivery_acts for all to authenticated
using (public.has_project_role(project_id, array['admin','coordinator']) or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id)))
with check (public.has_project_role(project_id, array['admin','coordinator']) or (public.has_project_role(project_id, array['technician']) and public.can_access_family(family_id)));

create or replace function public.confirm_delivery_act(
  p_family_id uuid, p_operational_plan_id uuid, p_delivery_date date,
  p_items jsonb, p_observations text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_project_id uuid; v_delivery_id uuid; v_act_id uuid; v_sequence integer;
  v_status text; v_item jsonb; v_material record; v_snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesion.' using errcode='42501'; end if;
  if p_delivery_date is null then raise exception 'La fecha de entrega es obligatoria.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Seleccione al menos un material.'; end if;
  select project_id into v_project_id from public.operational_plans
  where id=p_operational_plan_id and family_id=p_family_id and status='approved' and is_deleted=false;
  if not found or not public.can_access_family(p_family_id) then raise exception 'Familia o plan no autorizado.' using errcode='42501'; end if;
  if not (public.has_project_role(v_project_id,array['admin','coordinator']) or public.has_project_role(v_project_id,array['technician'])) then
    raise exception 'No autorizado para confirmar actas.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_family_id::text, 0));
  select coalesce(max(act_sequence),0)+1 into v_sequence from public.delivery_acts where family_id=p_family_id;
  insert into public.material_deliveries(project_id,family_id,operational_plan_id,delivery_date,status,observations,registered_by)
  values(v_project_id,p_family_id,p_operational_plan_id,p_delivery_date,'entregado_parcial',nullif(trim(p_observations),''),public.current_profile_id()) returning id into v_delivery_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'quantity')::numeric,0) <= 0 then raise exception 'Todas las cantidades deben ser mayores que cero.'; end if;
    select ppm.id, pa.id plan_activity_id, pa.activity_id, ppm.material_id, ppm.provisional_material_id,
      coalesce(mc.name,pm.provisional_name) material_name, ppm.unit, ppm.quantity, ppm.quoted_unit_price
      into v_material
    from public.plan_project_materials ppm join public.plan_activities pa on pa.id=ppm.plan_activity_id
    left join public.material_catalog mc on mc.id=ppm.material_id
    left join public.provisional_materials pm on pm.id=ppm.provisional_material_id
    where ppm.id=(v_item->>'plan_project_material_id')::uuid and pa.plan_id=p_operational_plan_id
      and not ppm.is_deleted and not pa.is_deleted for update of ppm;
    if not found then raise exception 'Uno de los materiales no pertenece al plan aprobado.'; end if;
    insert into public.material_delivery_items(material_delivery_id,project_id,family_id,operational_plan_id,plan_activity_id,activity_id,
      plan_project_material_id,material_id,provisional_material_id,material_name,unit,approved_quantity,delivered_quantity,unit_price,observations)
    values(v_delivery_id,v_project_id,p_family_id,p_operational_plan_id,v_material.plan_activity_id,v_material.activity_id,
      v_material.id,v_material.material_id,v_material.provisional_material_id,v_material.material_name,v_material.unit,
      v_material.quantity,(v_item->>'quantity')::numeric,v_material.quoted_unit_price,nullif(trim(p_observations),''));
  end loop;
  select case when exists(select 1 from public.plan_project_materials ppm join public.plan_activities pa on pa.id=ppm.plan_activity_id
    where pa.plan_id=p_operational_plan_id and not ppm.is_deleted and not pa.is_deleted and ppm.quantity >
      coalesce((select sum(mdi.delivered_quantity) from public.material_delivery_items mdi where mdi.plan_project_material_id=ppm.id and not mdi.is_deleted),0))
    then 'entregado_parcial' else 'entregado_total' end into v_status;
  update public.material_deliveries set status=v_status where id=v_delivery_id;
  insert into public.delivery_acts(project_id,family_id,operational_plan_id,material_delivery_id,act_number,act_sequence,status,generated_by,observations)
  values(v_project_id,p_family_id,p_operational_plan_id,v_delivery_id,'Acta '||v_sequence,v_sequence,'generated',public.current_profile_id(),nullif(trim(p_observations),'')) returning id into v_act_id;
  select jsonb_agg(to_jsonb(i) order by i.material_name,i.id) into v_snapshot from public.material_delivery_items i where i.material_delivery_id=v_delivery_id and not i.is_deleted;
  insert into public.delivery_act_versions(delivery_act_id,project_id,family_id,version,status,delivery_date,observations,items,created_by)
  values(v_act_id,v_project_id,p_family_id,1,'generated',p_delivery_date,nullif(trim(p_observations),''),v_snapshot,auth.uid());
  return v_act_id;
end $$;

create or replace function public.correct_delivery_act(
  p_delivery_act_id uuid, p_delivery_date date, p_items jsonb, p_observations text default null
) returns void language plpgsql security invoker set search_path=public as $$
declare v_act record; v_item jsonb; v_material record; v_snapshot jsonb; v_status text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Seleccione al menos un material.'; end if;
  select * into v_act from public.delivery_acts where id=p_delivery_act_id and not is_deleted for update;
  if not found or v_act.status='void' or not (public.has_project_role(v_act.project_id,array['admin','coordinator']) or (public.has_project_role(v_act.project_id,array['technician']) and public.can_access_family(v_act.family_id))) then
    raise exception 'Acta no encontrada, anulada o no autorizada.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_act.family_id::text,0));
  update public.material_delivery_items set is_deleted=true where material_delivery_id=v_act.material_delivery_id and not is_deleted;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'quantity')::numeric,0)<=0 then raise exception 'Todas las cantidades deben ser mayores que cero.'; end if;
    select ppm.id,pa.id plan_activity_id,pa.activity_id,ppm.material_id,ppm.provisional_material_id,
      coalesce(mc.name,pm.provisional_name) material_name,ppm.unit,ppm.quantity,ppm.quoted_unit_price into v_material
    from public.plan_project_materials ppm join public.plan_activities pa on pa.id=ppm.plan_activity_id
    left join public.material_catalog mc on mc.id=ppm.material_id left join public.provisional_materials pm on pm.id=ppm.provisional_material_id
    where ppm.id=(v_item->>'plan_project_material_id')::uuid and pa.plan_id=v_act.operational_plan_id
      and not ppm.is_deleted and not pa.is_deleted for update of ppm;
    if not found then raise exception 'Uno de los materiales no pertenece al plan aprobado.'; end if;
    insert into public.material_delivery_items(material_delivery_id,project_id,family_id,operational_plan_id,plan_activity_id,activity_id,
      plan_project_material_id,material_id,provisional_material_id,material_name,unit,approved_quantity,delivered_quantity,unit_price,observations)
    values(v_act.material_delivery_id,v_act.project_id,v_act.family_id,v_act.operational_plan_id,v_material.plan_activity_id,v_material.activity_id,
      v_material.id,v_material.material_id,v_material.provisional_material_id,v_material.material_name,v_material.unit,v_material.quantity,
      (v_item->>'quantity')::numeric,v_material.quoted_unit_price,nullif(trim(p_observations),''));
  end loop;
  select case when exists(select 1 from public.plan_project_materials ppm join public.plan_activities pa on pa.id=ppm.plan_activity_id
    where pa.plan_id=v_act.operational_plan_id and not ppm.is_deleted and not pa.is_deleted and ppm.quantity >
      coalesce((select sum(mdi.delivered_quantity) from public.material_delivery_items mdi where mdi.plan_project_material_id=ppm.id and not mdi.is_deleted),0))
    then 'entregado_parcial' else 'entregado_total' end into v_status;
  update public.material_deliveries set delivery_date=p_delivery_date,status=v_status,observations=nullif(trim(p_observations),'') where id=v_act.material_delivery_id;
  update public.delivery_acts set version=version+1,status='generated',observations=nullif(trim(p_observations),''),voided_at=null,voided_by=null where id=v_act.id;
  select jsonb_agg(to_jsonb(i) order by i.material_name,i.id) into v_snapshot from public.material_delivery_items i where i.material_delivery_id=v_act.material_delivery_id and not i.is_deleted;
  insert into public.delivery_act_versions(delivery_act_id,project_id,family_id,version,status,delivery_date,observations,items,created_by)
  values(v_act.id,v_act.project_id,v_act.family_id,v_act.version+1,'generated',p_delivery_date,nullif(trim(p_observations),''),v_snapshot,auth.uid());
end $$;

create or replace function public.void_delivery_act(p_delivery_act_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare v_act record; v_snapshot jsonb;
begin
  select * into v_act from public.delivery_acts where id=p_delivery_act_id and not is_deleted for update;
  if not found or not (public.has_project_role(v_act.project_id,array['admin','coordinator']) or (public.has_project_role(v_act.project_id,array['technician']) and public.can_access_family(v_act.family_id))) then
    raise exception 'Acta no encontrada o no autorizada.' using errcode='42501';
  end if;
  if v_act.status='void' then return; end if;
  select jsonb_agg(to_jsonb(i) order by i.material_name,i.id) into v_snapshot from public.material_delivery_items i where i.material_delivery_id=v_act.material_delivery_id and not i.is_deleted;
  update public.material_delivery_items set is_deleted=true where material_delivery_id=v_act.material_delivery_id and not is_deleted;
  update public.material_deliveries set status='cancelado' where id=v_act.material_delivery_id;
  update public.delivery_acts set status='void',version=version+1,voided_at=now(),voided_by=public.current_profile_id() where id=p_delivery_act_id;
  insert into public.delivery_act_versions(delivery_act_id,project_id,family_id,version,status,delivery_date,observations,items,created_by)
  values(v_act.id,v_act.project_id,v_act.family_id,v_act.version+1,'void',(select delivery_date from public.material_deliveries where id=v_act.material_delivery_id),v_act.observations,v_snapshot,auth.uid());
end $$;

revoke all on function public.confirm_delivery_act(uuid,uuid,date,jsonb,text) from public,anon;
revoke all on function public.correct_delivery_act(uuid,date,jsonb,text) from public,anon;
revoke all on function public.void_delivery_act(uuid) from public,anon;
grant execute on function public.confirm_delivery_act(uuid,uuid,date,jsonb,text) to authenticated;
grant execute on function public.correct_delivery_act(uuid,date,jsonb,text) to authenticated;
grant execute on function public.void_delivery_act(uuid) to authenticated;
revoke all on function public.validate_phase5_delivery_act() from public,anon,authenticated;

-- El historial general tambien registra actas y sus versiones.
drop trigger if exists capture_audit_history on public.delivery_acts;
create trigger capture_audit_history after insert or update or delete on public.delivery_acts
for each row execute function private.capture_audit_history();

notify pgrst, 'reload schema';
