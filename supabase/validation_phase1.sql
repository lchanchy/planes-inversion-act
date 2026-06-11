-- Validacion ejecutable Fase 1.
-- Ejecutar despues de aplicar:
--   1) supabase/migrations/20260610220000_initial_schema.sql
--   2) supabase/seed.sql
--
-- El script usa transaccion y ROLLBACK para no dejar datos de prueba.

begin;

-- Usuarios Auth minimos para poder probar RLS con auth.uid().
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'phase1-admin@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'phase1-tech@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'phase1-viewer@example.com', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.users_profiles (id, auth_user_id, full_name, default_role_id)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'QA Admin', (select id from public.roles where name = 'admin')),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'QA Tecnico', (select id from public.roles where name = 'technician')),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'QA Visor', (select id from public.roles where name = 'viewer'))
on conflict (id) do nothing;

insert into public.project_users (project_id, user_id, role_id, can_approve_plans, can_manage_purchases, can_generate_documents)
values
  ('00000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001', (select id from public.roles where name = 'admin'), true, true, true),
  ('00000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000002', (select id from public.roles where name = 'technician'), false, false, false),
  ('00000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000003', (select id from public.roles where name = 'viewer'), false, false, false)
on conflict (project_id, user_id) do update
set role_id = excluded.role_id,
    can_approve_plans = excluded.can_approve_plans,
    can_manage_purchases = excluded.can_manage_purchases,
    can_generate_documents = excluded.can_generate_documents;

insert into public.families (
  id,
  project_id,
  family_code,
  representative_name,
  document_number,
  municipality_id,
  village_id
)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'QA-001', 'Familia Asignada', 'QA-DOC-001', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', 'QA-002', 'Familia No Asignada', 'QA-DOC-002', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301')
on conflict (project_id, family_code) do nothing;

insert into public.family_assignments (project_id, family_id, technician_id, assigned_by)
values (
  '00000000-0000-0000-0000-000000000101',
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001'
)
on conflict (family_id, technician_id) do nothing;

insert into public.operational_plans (
  id,
  project_id,
  family_id,
  technician_id,
  status
)
values (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'approved'
)
on conflict (project_id, family_id, version) do nothing;

do $$
declare
  v_tables integer;
  v_types integer;
  v_indexes integer;
  v_functions integer;
  v_triggers integer;
  v_policies integer;
  v_code_1 text;
  v_code_2 text;
  v_duplicate_blocked boolean := false;
  v_overdelivery_blocked boolean := false;
begin
  select count(*) into v_tables
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'projects','users_profiles','roles','project_users','family_assignments',
      'families','operational_plans','purchases','purchase_family_allocations',
      'delivery_records','delivery_record_items','physical_indicators','sync_logs'
    );
  if v_tables < 13 then
    raise exception 'Faltan tablas principales. Encontradas: %', v_tables;
  end if;
  raise notice 'TABLAS OK';

  select count(*) into v_types
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname in (
      'project_status','record_status','plan_status','purchase_status',
      'delivery_status','material_resolution_status','indicator_light_status'
    );
  if v_types <> 7 then
    raise exception 'Tipos de estado esperados: 7, encontrados: %', v_types;
  end if;
  raise notice 'TIPOS OK';

  select count(*) into v_indexes
  from pg_indexes
  where schemaname = 'public';
  if v_indexes < 20 then
    raise exception 'Indices insuficientes. Encontrados: %', v_indexes;
  end if;
  raise notice 'INDICES OK';

  select count(*) into v_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'generate_family_code','set_audit_fields','current_profile_id',
      'has_project_role','has_default_role','is_project_member',
      'can_access_family','recalculate_purchase_family_allocation',
      'sync_delivery_item_allocation'
    );
  if v_functions <> 9 then
    raise exception 'Funciones esperadas: 9, encontradas: %', v_functions;
  end if;
  raise notice 'FUNCIONES OK';

  select count(*) into v_triggers
  from pg_trigger
  where not tgisinternal
    and tgname in ('trg_delivery_items_sync_allocation');
  if v_triggers <> 1 then
    raise exception 'No existe trigger de entregas parciales';
  end if;
  raise notice 'TRIGGERS OK';

  select count(*) into v_policies
  from pg_policies
  where schemaname = 'public';
  if v_policies < 50 then
    raise exception 'Politicas RLS insuficientes. Encontradas: %', v_policies;
  end if;
  raise notice 'POLITICAS RLS OK';

  v_code_1 := public.generate_family_code('00000000-0000-0000-0000-000000000101');
  v_code_2 := public.generate_family_code('00000000-0000-0000-0000-000000000101');
  if v_code_1 <> 'RE-0001' or v_code_2 <> 'RE-0002' then
    raise exception 'RPC consecutiva fallo. Codigos: %, %', v_code_1, v_code_2;
  end if;
  raise notice 'RPC OK';

  begin
    insert into public.families (
      project_id,
      family_code,
      representative_name,
      document_number,
      municipality_id,
      village_id
    )
    values (
      '00000000-0000-0000-0000-000000000101',
      'QA-001',
      'Duplicado',
      'QA-DOC-DUP',
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000301'
    );
  exception when unique_violation then
    v_duplicate_blocked := true;
  end;
  if not v_duplicate_blocked then
    raise exception 'No se bloqueo family_code duplicado dentro del proyecto';
  end if;
  raise notice 'DUPLICADOS OK';

  insert into public.purchases (id, project_id, purchase_number, name)
  values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 9901, 'Compra QA');

  insert into public.purchase_items (id, purchase_id, material_id, required_quantity, purchased_quantity, real_unit_price)
  values (
    '50000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    (select id from public.material_catalog where project_id = '00000000-0000-0000-0000-000000000101' order by name limit 1),
    10,
    10,
    1000
  );

  insert into public.purchase_family_allocations (id, purchase_item_id, family_id, allocated_quantity, real_unit_price)
  values (
    '50000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    5,
    1000
  );

  insert into public.delivery_records (id, project_id, purchase_id, family_id, status)
  values (
    '50000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000101',
    '50000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'generated'
  );

  begin
    insert into public.delivery_record_items (
      delivery_record_id,
      purchase_family_allocation_id,
      material_id,
      description,
      unit,
      delivered_quantity
    )
    values (
      '50000000-0000-0000-0000-000000000004',
      '50000000-0000-0000-0000-000000000003',
      (select material_id from public.purchase_items where id = '50000000-0000-0000-0000-000000000002'),
      'Entrega excesiva QA',
      'unidad',
      6
    );
  exception when raise_exception then
    v_overdelivery_blocked := true;
  end;
  if not v_overdelivery_blocked then
    raise exception 'No se bloqueo entrega mayor a cantidad asignada';
  end if;
  raise notice 'ENTREGAS PARCIALES OK';
end $$;

-- RLS: admin puede gestionar proyecto asignado.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
update public.projects
set intervention_zone = 'Zona QA admin'
where id = '00000000-0000-0000-0000-000000000101';
reset role;

do $$
declare
  v_zone text;
begin
  select intervention_zone into v_zone
  from public.projects
  where id = '00000000-0000-0000-0000-000000000101';
  if v_zone <> 'Zona QA admin' then
    raise exception 'RLS admin fallo: no pudo actualizar proyecto asignado';
  end if;
  raise notice 'RLS ADMIN OK';
end $$;

-- RLS: tecnico solo ve familia asignada.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
declare
  v_count integer;
  v_assigned integer;
  v_unassigned integer;
begin
  select count(*) into v_count from public.families;
  select count(*) into v_assigned from public.families where family_code = 'QA-001';
  select count(*) into v_unassigned from public.families where family_code = 'QA-002';
  if v_count <> 1 or v_assigned <> 1 or v_unassigned <> 0 then
    raise exception 'RLS tecnico fallo. count=%, assigned=%, unassigned=%', v_count, v_assigned, v_unassigned;
  end if;
  raise notice 'RLS TECNICO LECTURA OK';
end $$;
reset role;

-- RLS: tecnico no puede editar planes aprobados.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
update public.operational_plans
set total_project_value = 999999
where id = '40000000-0000-0000-0000-000000000001';
do $$
declare
  v_total_project_value numeric(14,2);
begin
  select total_project_value into v_total_project_value
  from public.operational_plans
  where id = '40000000-0000-0000-0000-000000000001';
  if v_total_project_value = 999999 then
    raise exception 'RLS tecnico fallo: edito plan aprobado';
  end if;
  raise notice 'RLS TECNICO PLAN APROBADO OK';
end $$;
reset role;

-- RLS: visor no puede escribir.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
update public.projects
set intervention_zone = 'Zona QA visor indebida'
where id = '00000000-0000-0000-0000-000000000101';
reset role;

do $$
declare
  v_zone text;
begin
  select intervention_zone into v_zone
  from public.projects
  where id = '00000000-0000-0000-0000-000000000101';
  if v_zone = 'Zona QA visor indebida' then
    raise exception 'RLS visor fallo: pudo escribir';
  end if;
  raise notice 'RLS VISOR OK';
  raise notice 'RLS OK';
end $$;

select 'FASE 1 VALIDADA EN SQL' as resultado;

rollback;
