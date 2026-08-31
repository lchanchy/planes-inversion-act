-- Fase 8B: monitoreo anual, unidades fieles, calculos normalizados y sync atomico.
-- Los registros existentes se conservan y se normalizan antes de crear las reglas anuales.
-- Cualquier limpieza de pruebas debe realizarse en una migracion separada y auditable.

-- Las unidades son datos de catalogo, no un conjunto cerrado: se convierten a texto
-- para aceptar fielmente g, kg, litro, unidad y animal sin bloquear futuras unidades.
alter table public.economia_productos alter column unidad_base drop default;
alter table public.economia_productos alter column unidad_base type text using unidad_base::text;
alter table public.economia_productos alter column unidad_base set default 'kg';
alter table public.economia_encuesta_productos alter column unidad type text using unidad::text;

alter table public.economia_encuestas
  add column if not exists anio smallint,
  add column if not exists tipo_medicion text,
  add column if not exists numero_monitoreo integer,
  add column if not exists server_version bigint not null default 1,
  add column if not exists revision integer not null default 1,
  add column if not exists notas_revision text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists es_piloto boolean not null default false;

update public.economia_encuestas e
set anio = extract(year from e.fecha)::smallint,
    tipo_medicion = case when r.codigo = 'linea_base' then 'linea_base' else 'monitoreo' end,
    numero_monitoreo = case
      when r.codigo ~ '^monitoreo_[0-9]+$' then substring(r.codigo from '[0-9]+$')::integer
      else null
    end,
    es_piloto = coalesce(e.es_piloto, false)
from public.economia_rondas r
where r.id = e.ronda_id
  and (e.anio is null or e.tipo_medicion is null);

update public.economia_encuestas
set anio = coalesce(anio, extract(year from fecha)::smallint),
    tipo_medicion = coalesce(tipo_medicion, 'linea_base'),
    es_piloto = coalesce(es_piloto, false)
where anio is null or tipo_medicion is null;

alter table public.economia_encuestas
  alter column anio set not null,
  alter column tipo_medicion set not null;

alter table public.economia_encuestas drop constraint if exists economia_encuestas_familia_ronda_unique;
alter table public.economia_encuestas drop constraint if exists economia_encuestas_anio_check;
alter table public.economia_encuestas add constraint economia_encuestas_anio_check check (anio between 2000 and 2100);
alter table public.economia_encuestas drop constraint if exists economia_encuestas_medicion_check;
alter table public.economia_encuestas add constraint economia_encuestas_medicion_check check (
  (tipo_medicion = 'linea_base' and numero_monitoreo is null) or
  (tipo_medicion = 'monitoreo' and numero_monitoreo > 0)
);

create unique index if not exists economia_encuestas_familia_anio_live
  on public.economia_encuestas(family_id, anio) where is_deleted = false;
create unique index if not exists economia_encuestas_linea_base_live
  on public.economia_encuestas(family_id) where tipo_medicion = 'linea_base' and is_deleted = false;
create unique index if not exists economia_encuestas_monitoreo_live
  on public.economia_encuestas(family_id, numero_monitoreo)
  where tipo_medicion = 'monitoreo' and is_deleted = false;
create index if not exists idx_economia_encuestas_reporting
  on public.economia_encuestas(project_id, anio, tipo_medicion, numero_monitoreo, estado)
  where is_deleted = false;

create or replace function public.economia_validar_secuencia()
returns trigger language plpgsql set search_path=public as $$
declare
  v_ultimo_numero integer;
  v_ultimo_estado text;
  v_ultimo_anio smallint;
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id
       or new.tipo_medicion <> old.tipo_medicion
       or new.numero_monitoreo is distinct from old.numero_monitoreo then
      raise exception 'ECONOMIA_SEQUENCE_IMMUTABLE' using errcode='23514';
    end if;
    return new;
  end if;

  -- Los UPSERT entran primero como INSERT. Si el mismo UUID ya existe, se deja
  -- continuar para que ON CONFLICT ejecute la rama UPDATE y sus controles.
  if exists(select 1 from public.economia_encuestas where id=new.id) then
    return new;
  end if;

  if new.tipo_medicion = 'linea_base' then
    if exists(select 1 from public.economia_encuestas where family_id=new.family_id and not is_deleted) then
      raise exception 'ECONOMIA_BASELINE_ALREADY_EXISTS' using errcode='23505';
    end if;
    return new;
  end if;

  select numero_monitoreo, estado, anio
    into v_ultimo_numero, v_ultimo_estado, v_ultimo_anio
  from public.economia_encuestas
  where family_id=new.family_id and not is_deleted
  order by case when tipo_medicion='linea_base' then 0 else numero_monitoreo end desc
  limit 1;

  if not found or v_ultimo_estado <> 'aprobada'
     or new.numero_monitoreo <> coalesce(v_ultimo_numero,0)+1
     or new.anio <= v_ultimo_anio then
    raise exception 'ECONOMIA_PREVIOUS_MEASUREMENT_NOT_APPROVED' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_economia_validar_secuencia on public.economia_encuestas;
create trigger trg_economia_validar_secuencia
before insert or update of family_id,tipo_medicion,numero_monitoreo on public.economia_encuestas
for each row execute function public.economia_validar_secuencia();
revoke all on function public.economia_validar_secuencia() from public, anon, authenticated;

alter table public.economia_encuesta_apoyos drop constraint if exists economia_encuesta_apoyos_unique;
create unique index if not exists economia_encuesta_apoyos_live_unique on public.economia_encuesta_apoyos(encuesta_id,tipo_apoyo_id) where is_deleted=false;
alter table public.economia_encuesta_pagos drop constraint if exists economia_encuesta_pagos_unique;
create unique index if not exists economia_encuesta_pagos_live_unique on public.economia_encuesta_pagos(encuesta_id,tipo_pago_id) where is_deleted=false;
alter table public.economia_producto_lugares_venta drop constraint if exists economia_producto_lugares_venta_unique;
create unique index if not exists economia_producto_lugares_live_unique on public.economia_producto_lugares_venta(encuesta_producto_id,lugar_venta_id) where is_deleted=false;

alter table public.economia_encuestas drop constraint if exists economia_encuestas_devolucion_notas_check;
update public.economia_encuestas set notas_revision='Dato de prueba migrado: requiere revisión' where estado='devuelta' and nullif(btrim(notas_revision),'') is null;
alter table public.economia_encuestas add constraint economia_encuestas_devolucion_notas_check
  check (estado <> 'devuelta' or nullif(btrim(notas_revision),'') is not null);

-- El tecnico puede corregir borradores/devueltas, pero nunca aprobar ni reabrir por su cuenta.
drop policy if exists economia_encuestas_update_scoped on public.economia_encuestas;
create policy economia_encuestas_update_scoped on public.economia_encuestas for update to authenticated
using (
  public.has_project_role(project_id,array['admin','coordinator']) or
  (public.has_project_role(project_id,array['technician']) and public.can_access_family(family_id) and estado in ('borrador','completada','devuelta'))
)
with check (
  public.has_project_role(project_id,array['admin','coordinator']) or
  (public.has_project_role(project_id,array['technician']) and public.can_access_family(family_id) and estado in ('borrador','completada'))
);

-- Unidades originales del XLSForm. El valor queda copiado en cada captura para preservar historia.
update public.economia_productos set unidad_base = 'litro' where codigo in
  ('champu','fabuloso','jarabe','leche','limpia_pisos','miel','aceite_milpes','vino','Aceite_Castaño','Aceite_Coco','Yogurth');
update public.economia_productos set unidad_base = 'g' where codigo in ('mermelada','multimezcla','talco');
update public.economia_productos set unidad_base = 'unidad' where codigo in
  ('jabon_bano','plantulas','huevos','artesania','cestos','Chocolate','Envueltos','Tortas');
update public.economia_productos set unidad_base = 'animal' where es_pecuario and codigo not in ('huevos','leche','miel');

alter table public.economia_encuesta_productos drop column if exists ingreso_mensual;
alter table public.economia_encuesta_productos
  add column ingreso_periodo numeric(16,2) generated always as
    (coalesce(vendido,0) * coalesce(precio_unitario,0)) stored,
  add column ingreso_anual numeric(16,2) generated always as (
    coalesce(vendido,0) * coalesce(precio_unitario,0) *
    case coalesce(temporalidad, 'mensual'::public.economia_temporalidad)
      when 'diario'::public.economia_temporalidad then 365 when 'semanal'::public.economia_temporalidad then 52 when 'quincenal'::public.economia_temporalidad then 24
      when 'mensual'::public.economia_temporalidad then 12 when 'trimestral'::public.economia_temporalidad then 4 when 'semestral'::public.economia_temporalidad then 2
      when 'anual'::public.economia_temporalidad then 1 else 12 end
  ) stored,
  add column ingreso_mensual numeric(16,2) generated always as (
    coalesce(vendido,0) * coalesce(precio_unitario,0) *
    case coalesce(temporalidad, 'mensual'::public.economia_temporalidad)
      when 'diario'::public.economia_temporalidad then 365.0/12 when 'semanal'::public.economia_temporalidad then 52.0/12 when 'quincenal'::public.economia_temporalidad then 2
      when 'mensual'::public.economia_temporalidad then 1 when 'trimestral'::public.economia_temporalidad then 1.0/3 when 'semestral'::public.economia_temporalidad then 1.0/6
      when 'anual'::public.economia_temporalidad then 1.0/12 else 1 end
  ) stored;

alter table public.economia_encuesta_productos drop constraint if exists economia_producto_cantidades_check;
alter table public.economia_encuesta_productos add constraint economia_producto_cantidades_check check (
  coalesce(cantidad_producida,0) >= 0 and coalesce(consumo,0) >= 0 and coalesce(vendido,0) >= 0
  and coalesce(precio_unitario,0) >= 0
  and coalesce(consumo,0) + coalesce(vendido,0) <= coalesce(cantidad_producida,0)
);
alter table public.economia_encuesta_productos drop constraint if exists economia_producto_venta_check;
alter table public.economia_encuesta_productos add constraint economia_producto_venta_check check (
  (coalesce(vendido,0) = 0 and nullif(btrim(motivo_no_venta),'') is not null)
  or (vendido > 0 and precio_unitario > 0)
);
alter table public.economia_encuesta_productos drop constraint if exists economia_producto_unidad_check;
alter table public.economia_encuesta_productos add constraint economia_producto_unidad_check check (unidad is not null);
alter table public.economia_encuesta_productos drop constraint if exists economia_producto_temporalidad_check;
alter table public.economia_encuesta_productos add constraint economia_producto_temporalidad_check check (
  temporalidad is not null
);

create table if not exists public.economia_sync_conflictos(
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null,
  project_id uuid not null references public.projects(id),
  family_id uuid not null references public.families(id),
  expected_version bigint not null,
  current_version bigint,
  server_payload jsonb,
  client_payload jsonb not null,
  estado text not null default 'pendiente' check(estado in ('pendiente','resuelto_servidor','resuelto_cliente','resuelto_manual')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.economia_sync_conflictos enable row level security;
drop policy if exists economia_sync_conflictos_select on public.economia_sync_conflictos;
create policy economia_sync_conflictos_select on public.economia_sync_conflictos for select to authenticated
  using(public.has_default_role(array['admin','super_admin']) or public.can_access_family(family_id));
drop policy if exists economia_sync_conflictos_insert on public.economia_sync_conflictos;
create policy economia_sync_conflictos_insert on public.economia_sync_conflictos for insert to authenticated
  with check(public.has_default_role(array['admin','super_admin']) or public.can_access_family(family_id));
drop policy if exists economia_sync_conflictos_update on public.economia_sync_conflictos;
create policy economia_sync_conflictos_update on public.economia_sync_conflictos for update to authenticated
  using(public.has_default_role(array['admin','super_admin']) or public.has_project_role(project_id,array['admin','coordinator']))
  with check(public.has_default_role(array['admin','super_admin']) or public.has_project_role(project_id,array['admin','coordinator']));
grant select,insert,update on public.economia_sync_conflictos to authenticated;
create index if not exists idx_economia_conflictos_pendientes on public.economia_sync_conflictos(project_id,estado,created_at desc);

-- Devuelve la secuencia siguiente; el servidor es la autoridad, no el reloj del dispositivo.
create or replace function public.economia_siguiente_medicion(p_family_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select case
    when not exists (select 1 from economia_encuestas where family_id=p_family_id and tipo_medicion='linea_base' and not is_deleted)
      then jsonb_build_object('tipo_medicion','linea_base','numero_monitoreo',null)
    else jsonb_build_object('tipo_medicion','monitoreo','numero_monitoreo',
      coalesce((select max(numero_monitoreo) from economia_encuestas where family_id=p_family_id and tipo_medicion='monitoreo' and not is_deleted),0)+1)
  end;
$$;
grant execute on function public.economia_siguiente_medicion(uuid) to authenticated;

-- Sync agregado: reemplaza hijos dentro de la misma transaccion y usa version optimista.
create or replace function public.sync_economia_encuesta(
  p_encuesta jsonb, p_apoyos jsonb default '[]', p_pagos jsonb default '[]',
  p_productos jsonb default '[]', p_expected_version bigint default 0
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := (p_encuesta->>'id')::uuid;
  v_current bigint;
  v_row jsonb;
  v_product_id uuid;
begin
  select server_version into v_current from economia_encuestas where id=v_id and not is_deleted for update;
  if not found and p_expected_version <> 0 then
    insert into economia_sync_conflictos(encuesta_id,project_id,family_id,expected_version,current_version,client_payload)
    values(v_id,(p_encuesta->>'project_id')::uuid,(p_encuesta->>'family_id')::uuid,p_expected_version,null,
      jsonb_build_object('encuesta',p_encuesta,'apoyos',p_apoyos,'pagos',p_pagos,'productos',p_productos));
    return jsonb_build_object('id',v_id,'conflict',true,'server_version',0,'revision',0,'estado','conflicto');
  end if;
  if found and v_current <> p_expected_version then
    insert into economia_sync_conflictos(encuesta_id,project_id,family_id,expected_version,current_version,server_payload,client_payload)
    select v_id,e.project_id,e.family_id,p_expected_version,v_current,to_jsonb(e),
      jsonb_build_object('encuesta',p_encuesta,'apoyos',p_apoyos,'pagos',p_pagos,'productos',p_productos)
    from economia_encuestas e where e.id=v_id;
    return jsonb_build_object('id',v_id,'conflict',true,'server_version',v_current,'revision',0,'estado','conflicto');
  end if;
  if found and exists (select 1 from economia_encuestas where id=v_id and estado in ('aprobada','cerrada')) then
    raise exception 'ECONOMIA_LOCKED' using errcode='55000';
  end if;

  insert into economia_encuestas(
    id,project_id,family_id,ronda_id,fecha,cambio_num_personas,personas_ninos,
    personas_adolescentes,personas_jovenes,personas_adultos,personas_mayores,
    recibe_apoyo_gobierno,recibe_otros_pagos,valor_jornal,estado,observaciones,
    anio,tipo_medicion,numero_monitoreo,server_version,revision,created_by,updated_by
  ) values (
    v_id,(p_encuesta->>'project_id')::uuid,(p_encuesta->>'family_id')::uuid,nullif(p_encuesta->>'ronda_id','')::uuid,
    (p_encuesta->>'fecha')::date,(p_encuesta->>'cambio_num_personas')::boolean,
    (p_encuesta->>'personas_ninos')::integer,(p_encuesta->>'personas_adolescentes')::integer,
    (p_encuesta->>'personas_jovenes')::integer,(p_encuesta->>'personas_adultos')::integer,
    (p_encuesta->>'personas_mayores')::integer,(p_encuesta->>'recibe_apoyo_gobierno')::boolean,
    (p_encuesta->>'recibe_otros_pagos')::boolean,(p_encuesta->>'valor_jornal')::numeric,
    coalesce(p_encuesta->>'estado','completada'),nullif(p_encuesta->>'observaciones',''),
    (p_encuesta->>'anio')::smallint,p_encuesta->>'tipo_medicion',(p_encuesta->>'numero_monitoreo')::integer,
    1,1,auth.uid(),auth.uid()
  ) on conflict (id) do update set
    fecha=excluded.fecha,cambio_num_personas=excluded.cambio_num_personas,
    personas_ninos=excluded.personas_ninos,personas_adolescentes=excluded.personas_adolescentes,
    personas_jovenes=excluded.personas_jovenes,personas_adultos=excluded.personas_adultos,
    personas_mayores=excluded.personas_mayores,recibe_apoyo_gobierno=excluded.recibe_apoyo_gobierno,
    recibe_otros_pagos=excluded.recibe_otros_pagos,valor_jornal=excluded.valor_jornal,
    estado=excluded.estado,observaciones=excluded.observaciones,anio=excluded.anio,
    tipo_medicion=excluded.tipo_medicion,numero_monitoreo=excluded.numero_monitoreo,
    server_version=economia_encuestas.server_version+1,revision=economia_encuestas.revision+1,
    updated_by=auth.uid(),updated_at=now();

  update economia_encuesta_apoyos set is_deleted=true,updated_at=now(),updated_by=auth.uid() where encuesta_id=v_id and not is_deleted;
  for v_row in select value from jsonb_array_elements(p_apoyos) loop
    insert into economia_encuesta_apoyos(id,encuesta_id,project_id,family_id,tipo_apoyo_id,valor_mensual,nombre_libre,created_by,updated_by,is_deleted)
    values ((v_row->>'id')::uuid,v_id,(p_encuesta->>'project_id')::uuid,(p_encuesta->>'family_id')::uuid,
      (v_row->>'tipo_apoyo_id')::uuid,(v_row->>'valor_mensual')::numeric,nullif(v_row->>'nombre_libre',''),auth.uid(),auth.uid(),false)
    on conflict(id) do update set valor_mensual=excluded.valor_mensual,nombre_libre=excluded.nombre_libre,is_deleted=false,updated_by=auth.uid(),updated_at=now();
  end loop;

  update economia_encuesta_pagos set is_deleted=true,updated_at=now(),updated_by=auth.uid() where encuesta_id=v_id and not is_deleted;
  for v_row in select value from jsonb_array_elements(p_pagos) loop
    insert into economia_encuesta_pagos(id,encuesta_id,project_id,family_id,tipo_pago_id,valor_mensual,created_by,updated_by,is_deleted)
    values ((v_row->>'id')::uuid,v_id,(p_encuesta->>'project_id')::uuid,(p_encuesta->>'family_id')::uuid,
      (v_row->>'tipo_pago_id')::uuid,(v_row->>'valor_mensual')::numeric,auth.uid(),auth.uid(),false)
    on conflict(id) do update set valor_mensual=excluded.valor_mensual,is_deleted=false,updated_by=auth.uid(),updated_at=now();
  end loop;

  update economia_producto_lugares_venta l set is_deleted=true,updated_at=now(),updated_by=auth.uid()
    where exists(select 1 from economia_encuesta_productos p where p.id=l.encuesta_producto_id and p.encuesta_id=v_id);
  update economia_encuesta_productos set is_deleted=true,updated_at=now(),updated_by=auth.uid() where encuesta_id=v_id and not is_deleted;
  for v_row in select value from jsonb_array_elements(p_productos) loop
    v_product_id := (v_row->>'id')::uuid;
    insert into economia_encuesta_productos(
      id,encuesta_id,project_id,family_id,producto_id,nombre_otro,unidad,es_pecuario,temporalidad,
      cantidad_producida,consumo,vendido,motivo_no_venta,precio_unitario,apoyo_act,created_by,updated_by,is_deleted
    ) values (
      v_product_id,v_id,(p_encuesta->>'project_id')::uuid,(p_encuesta->>'family_id')::uuid,
      nullif(v_row->>'producto_id','')::uuid,nullif(v_row->>'nombre_otro',''),v_row->>'unidad',
      coalesce((v_row->>'es_pecuario')::boolean,false),nullif(v_row->>'temporalidad','')::economia_temporalidad,
      (v_row->>'cantidad_producida')::numeric,(v_row->>'consumo')::numeric,(v_row->>'vendido')::numeric,
      nullif(v_row->>'motivo_no_venta',''),(v_row->>'precio_unitario')::numeric,(v_row->>'apoyo_act')::boolean,
      auth.uid(),auth.uid(),false
    ) on conflict(id) do update set producto_id=excluded.producto_id,nombre_otro=excluded.nombre_otro,
      unidad=excluded.unidad,es_pecuario=excluded.es_pecuario,temporalidad=excluded.temporalidad,
      cantidad_producida=excluded.cantidad_producida,consumo=excluded.consumo,vendido=excluded.vendido,
      motivo_no_venta=excluded.motivo_no_venta,precio_unitario=excluded.precio_unitario,
      apoyo_act=excluded.apoyo_act,is_deleted=false,updated_by=auth.uid(),updated_at=now();
    insert into economia_producto_lugares_venta(id,encuesta_producto_id,project_id,family_id,lugar_venta_id,nombre_libre,created_by,updated_by,is_deleted)
    select (x->>'id')::uuid,v_product_id,(p_encuesta->>'project_id')::uuid,(p_encuesta->>'family_id')::uuid,
      (x->>'lugar_venta_id')::uuid,nullif(x->>'nombre_libre',''),auth.uid(),auth.uid(),false
    from jsonb_array_elements(coalesce(v_row->'lugares','[]')) x
    on conflict(id) do update set lugar_venta_id=excluded.lugar_venta_id,nombre_libre=excluded.nombre_libre,is_deleted=false,updated_at=now(),updated_by=auth.uid();
  end loop;

  return (select jsonb_build_object('id',id,'conflict',false,'server_version',server_version,'revision',revision,'estado',estado) from economia_encuestas where id=v_id);
end;
$$;
revoke all on function public.sync_economia_encuesta(jsonb,jsonb,jsonb,jsonb,bigint) from public, anon;
grant execute on function public.sync_economia_encuesta(jsonb,jsonb,jsonb,jsonb,bigint) to authenticated;

-- Una encuesta de una familia piloto nunca debe entrar a reportes oficiales, aunque
-- un cliente antiguo omita el indicador es_piloto al sincronizarla.
create or replace function public.economia_marcar_piloto_por_familia()
returns trigger language plpgsql set search_path=public as $$
begin
  new.es_piloto := coalesce(new.es_piloto,false) or exists(
    select 1
    from public.families f
    where f.id=new.family_id
      and (f.family_code ilike 'PILOTO-%' or f.observations ilike '%PILOTO / NO OFICIAL%')
  );
  return new;
end;
$$;
drop trigger if exists trg_economia_marcar_piloto on public.economia_encuestas;
create trigger trg_economia_marcar_piloto
before insert or update of family_id,es_piloto on public.economia_encuestas
for each row execute function public.economia_marcar_piloto_por_familia();

update public.economia_encuestas e
set es_piloto=true,updated_at=now()
where not e.es_piloto
  and exists(
    select 1 from public.families f
    where f.id=e.family_id
      and (f.family_code ilike 'PILOTO-%' or f.observations ilike '%PILOTO / NO OFICIAL%')
  );

create or replace view public.economia_reporte_familiar with (security_invoker=true) as
select e.id,e.project_id,e.family_id,e.anio,e.tipo_medicion,e.numero_monitoreo,e.estado,e.es_piloto,
  e.personas_total,
  coalesce((select sum(a.valor_mensual) from economia_encuesta_apoyos a where a.encuesta_id=e.id and not a.is_deleted),0) as apoyos_mensual,
  coalesce((select sum(p.valor_mensual) from economia_encuesta_pagos p where p.encuesta_id=e.id and not p.is_deleted),0) as pagos_mensual,
  coalesce((select sum(p.ingreso_mensual) from economia_encuesta_productos p where p.encuesta_id=e.id and not p.is_deleted),0) as productos_mensual,
  coalesce((select sum(p.ingreso_anual) from economia_encuesta_productos p where p.encuesta_id=e.id and not p.is_deleted),0) +
  12*coalesce((select sum(a.valor_mensual) from economia_encuesta_apoyos a where a.encuesta_id=e.id and not a.is_deleted),0) +
  12*coalesce((select sum(p.valor_mensual) from economia_encuesta_pagos p where p.encuesta_id=e.id and not p.is_deleted),0) as ingreso_anual_total
from economia_encuestas e where not e.is_deleted;
grant select on public.economia_reporte_familiar to authenticated;

notify pgrst, 'reload schema';
