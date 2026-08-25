-- Bloque 6: validacion integral del backend Supabase.
-- No persiste datos: toda la prueba se ejecuta dentro de una transaccion.

begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'VALIDATION_BLOCK6: %', message; end if;
end;
$$;

-- 1. Contrato minimo de esquema, RLS, funciones e indices.
select pg_temp.assert_true(
  (select count(*) = 10 from information_schema.tables
   where table_schema = 'public' and table_name in (
     'roles','users_profiles','projects','project_users','families','operational_plans',
     'audit_logs','sync_logs','economia_encuestas','economia_sync_conflictos')),
  'faltan tablas criticas'
);

select pg_temp.assert_true(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
      and c.relname <> 'spatial_ref_sys' and not c.relrowsecurity
  ),
  'hay tablas publicas sin RLS'
);

select pg_temp.assert_true(
  to_regprocedure('public.sync_economia_encuesta(jsonb,jsonb,jsonb,jsonb,bigint)') is not null
  and to_regprocedure('public.economia_siguiente_medicion(uuid)') is not null
  and to_regprocedure('private.capture_audit_history()') is not null,
  'faltan funciones de monitoreo, sync o auditoria'
);

select pg_temp.assert_true(
  (select count(*) = 14 from pg_trigger t
   join pg_proc p on p.oid = t.tgfoid
   join pg_namespace n on n.oid = p.pronamespace
   where not t.tgisinternal and n.nspname = 'private' and p.proname = 'capture_audit_history'),
  'la auditoria no cubre las 14 tablas sensibles'
);

select pg_temp.assert_true(
  (select count(*) = 3 from pg_policies where schemaname = 'public' and policyname in (
    'audit_logs_select_authorized','sync_logs_select_scoped','sync_logs_insert_own')),
  'faltan politicas RLS de auditoria o diagnosticos sync'
);

select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT,UPDATE,DELETE')
  and has_table_privilege('authenticated', 'public.audit_logs', 'SELECT')
  and has_table_privilege('authenticated', 'public.sync_logs', 'SELECT,INSERT')
  and not has_table_privilege('authenticated', 'public.sync_logs', 'UPDATE,DELETE'),
  'privilegios de audit_logs o sync_logs incorrectos'
);

select pg_temp.assert_true(
  (select count(*) = 6 from pg_indexes where schemaname = 'public' and indexname in (
    'idx_audit_logs_created_at','idx_audit_logs_user_created','idx_sync_logs_status_started',
    'economia_encuestas_familia_anio_live','economia_encuestas_monitoreo_live',
    'idx_economia_conflictos_pendientes')),
  'faltan indices criticos'
);

-- 2. Fixtures aislados: dos proyectos, un administrador y dos tecnicos.
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('96000000-0000-0000-0000-000000000001','authenticated','authenticated','block6-admin@example.invalid','',now(),'{}','{}',now(),now()),
  ('96000000-0000-0000-0000-000000000002','authenticated','authenticated','block6-tech-a@example.invalid','',now(),'{}','{}',now(),now()),
  ('96000000-0000-0000-0000-000000000003','authenticated','authenticated','block6-tech-b@example.invalid','',now(),'{}','{}',now(),now());

insert into public.projects (id,name,code_prefix)
values
  ('96000000-0000-0000-0000-000000000101','QA Bloque 6 A','Q6A'),
  ('96000000-0000-0000-0000-000000000102','QA Bloque 6 B','Q6B');

insert into public.users_profiles (id,auth_user_id,full_name,default_role_id)
values
  ('96000000-0000-0000-0000-000000000201','96000000-0000-0000-0000-000000000001','QA Administrador',null),
  ('96000000-0000-0000-0000-000000000202','96000000-0000-0000-0000-000000000002','QA Tecnico A',null),
  ('96000000-0000-0000-0000-000000000203','96000000-0000-0000-0000-000000000003','QA Tecnico B',null);

insert into public.project_users (project_id,user_id,role_id)
values
  ('96000000-0000-0000-0000-000000000101','96000000-0000-0000-0000-000000000201',(select id from public.roles where name='project_admin')),
  ('96000000-0000-0000-0000-000000000101','96000000-0000-0000-0000-000000000202',(select id from public.roles where name='technician')),
  ('96000000-0000-0000-0000-000000000102','96000000-0000-0000-0000-000000000203',(select id from public.roles where name='technician'));

insert into public.families (id,project_id,family_code,representative_name,document_number)
values
  ('96000000-0000-0000-0000-000000000301','96000000-0000-0000-0000-000000000101','Q6A-0001','Familia QA A','Q6-DOC-A'),
  ('96000000-0000-0000-0000-000000000302','96000000-0000-0000-0000-000000000102','Q6B-0001','Familia QA B','Q6-DOC-B');

-- 3. RLS y auditoria: el administrador solo opera su proyecto.
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);

select pg_temp.assert_true(
  (select count(*) = 1 from public.families where id in (
    '96000000-0000-0000-0000-000000000301','96000000-0000-0000-0000-000000000302')),
  'RLS no aisla familias entre proyectos'
);

update public.families set phone = '3000000000'
where id = '96000000-0000-0000-0000-000000000301';

select pg_temp.assert_true(
  exists (select 1 from public.audit_logs
          where entity_type='families' and entity_id='96000000-0000-0000-0000-000000000301'
            and action='update' and user_id='96000000-0000-0000-0000-000000000201'
            and before_data->>'phone' is distinct from after_data->>'phone'),
  'no se registro el historial de actualizacion'
);

reset role;

-- 4. Sync: cada usuario inserta lo suyo y supervision ve solo su proyecto.
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000002',true);
insert into public.sync_logs (id,user_id,device_id,status)
values ('96000000-0000-0000-0000-000000000401','96000000-0000-0000-0000-000000000202','qa-device-a','success');

do $$
begin
  begin
    insert into public.sync_logs (user_id,device_id,status)
    values ('96000000-0000-0000-0000-000000000203','qa-impersonation','success');
    raise exception 'el tecnico inserto un diagnostico para otro usuario';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.sync_logs where id='96000000-0000-0000-0000-000000000401'),
  'el administrador de proyecto no ve el diagnostico de su tecnico'
);
reset role;

-- 5. Monitoreo anual: secuencia, unicidad y calculo por temporalidad.
insert into public.economia_rondas (id,codigo,nombre,orden)
values
  ('96000000-0000-0000-0000-000000000501','qa_block6_base','QA Linea base',990),
  ('96000000-0000-0000-0000-000000000502','qa_block6_m1','QA Monitoreo 1',991);

insert into public.economia_encuestas (
  id,project_id,family_id,ronda_id,fecha,anio,tipo_medicion,numero_monitoreo,estado
) values (
  '96000000-0000-0000-0000-000000000601','96000000-0000-0000-0000-000000000101',
  '96000000-0000-0000-0000-000000000301','96000000-0000-0000-0000-000000000501',
  '2025-06-01',2025,'linea_base',null,'aprobada'
),(
  '96000000-0000-0000-0000-000000000602','96000000-0000-0000-0000-000000000101',
  '96000000-0000-0000-0000-000000000301','96000000-0000-0000-0000-000000000502',
  '2026-06-01',2026,'monitoreo',1,'aprobada'
);

do $$
begin
  begin
    insert into public.economia_encuestas (
      project_id,family_id,ronda_id,fecha,anio,tipo_medicion,numero_monitoreo,estado
    ) values (
      '96000000-0000-0000-0000-000000000101','96000000-0000-0000-0000-000000000301',
      '96000000-0000-0000-0000-000000000502','2028-06-01',2028,'monitoreo',3,'borrador'
    );
    raise exception 'se acepto un monitoreo fuera de secuencia';
  exception when check_violation then null;
  end;
end $$;

insert into public.economia_encuesta_productos (
  id,encuesta_id,project_id,family_id,nombre_otro,unidad,temporalidad,
  cantidad_producida,consumo,vendido,precio_unitario,apoyo_act
) values (
  '96000000-0000-0000-0000-000000000701','96000000-0000-0000-0000-000000000602',
  '96000000-0000-0000-0000-000000000101','96000000-0000-0000-0000-000000000301',
  'Producto QA','kg','trimestral',10,0,10,1000,false
);

select pg_temp.assert_true(
  (select ingreso_periodo=10000 and ingreso_anual=40000 and round(ingreso_mensual,2)=3333.33
   from public.economia_encuesta_productos where id='96000000-0000-0000-0000-000000000701'),
  'calculo mensual/anual por temporalidad incorrecto'
);

select pg_temp.assert_true(
  public.economia_siguiente_medicion('96000000-0000-0000-0000-000000000301')->>'numero_monitoreo' = '2',
  'la siguiente medicion no es monitoreo 2'
);

select 'BLOQUE 6 VALIDADO: esquema, RLS, auditoria, sync y monitoreo anual' as resultado;

rollback;
