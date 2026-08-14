-- Datos ficticios solicitados para validar Economia Familiar en web y Android.
-- Se identifican como PILOTO / NO OFICIAL y quedan excluidos por defecto de reportes oficiales.
do $$
declare
  v_project uuid;
  v_ronda uuid;
  v_ronda_monitoreo1 uuid;
  v_cat_product uuid;
  v_lugar_venta uuid;
  v_municipality uuid;
  v_village uuid;
  v_family uuid;
  v_codes text[] := array['PILOTO-ECO-001','PILOTO-ECO-002','PILOTO-ECO-003','PILOTO-ECO-004','PILOTO-ECO-005'];
  v_names text[] := array['Familia Piloto Línea Base','Familia Piloto Monitoreo','Familia Piloto Devuelta','Familia Piloto Otros Productos','Familia Piloto Conflicto'];
  i integer;
begin
  select id into v_project from public.projects where not is_deleted order by created_at limit 1;
  if v_project is null then return; end if;
  select id into v_ronda from public.economia_rondas where codigo='linea_base' and not is_deleted limit 1;
  select id into v_ronda_monitoreo1 from public.economia_rondas where codigo='monitoreo_1' and not is_deleted limit 1;
  select id into v_cat_product from public.economia_productos where codigo='aguacate' and not is_deleted limit 1;
  select id into v_lugar_venta from public.economia_lugares_venta where codigo='en_vereda' and not is_deleted limit 1;
  select municipality_id, village_id
    into v_municipality, v_village
  from public.families
  where municipality_id is not null
    and not is_deleted
  order by village_id nulls last, created_at
  limit 1;
  if v_municipality is null then
    select municipality_id, id
      into v_municipality, v_village
    from public.villages
    order by name
    limit 1;
  end if;
  if v_municipality is null then
    select id into v_municipality
    from public.municipalities
    order by name
    limit 1;
  end if;

  for i in 1..5 loop
    v_family := ('e0000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    insert into public.families(
      id,project_id,family_code,representative_name,municipality_id,village_id,
      observations,status,validation_status
    )
    values(
      v_family,v_project,v_codes[i],v_names[i],v_municipality,v_village,
      'PILOTO / NO OFICIAL','active','validated'
    )
    on conflict(id) do update set
      municipality_id=excluded.municipality_id,
      village_id=excluded.village_id,
      observations=excluded.observations,
      status=excluded.status,
      validation_status=excluded.validation_status,
      is_deleted=false,
      updated_at=now();
    insert into public.economia_familias(id,project_id,family_id,activo,notas)
    values(('e1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,v_project,v_family,true,'PILOTO / NO OFICIAL')
    on conflict(family_id) do update set activo=true,notas=excluded.notas,is_deleted=false;
  end loop;

  -- Cinco líneas base con composiciones y estados distintos.
  for i in 1..5 loop
    v_family := ('e0000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    insert into public.economia_encuestas(
      id,project_id,family_id,ronda_id,fecha,cambio_num_personas,personas_ninos,personas_adolescentes,
      personas_jovenes,personas_adultos,personas_mayores,recibe_apoyo_gobierno,recibe_otros_pagos,
      valor_jornal,estado,observaciones,notas_revision,anio,tipo_medicion,numero_monitoreo,es_piloto
    ) values(
      ('e2000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,v_project,v_family,v_ronda,
      make_date(2026,1,i),true,i,1,1,2,1,i in (2,4),i=2,80000,
      case i when 3 then 'devuelta' else 'aprobada' end,
      case i when 3 then 'PILOTO: corregir lugar de venta' when 5 then 'PILOTO: usar para prueba de conflicto' else 'PILOTO / NO OFICIAL' end,
      case i when 3 then 'PILOTO: corregir lugar de venta' else null end,
      2026,'linea_base',null,true
    ) on conflict(id) do nothing;
  end loop;

  -- Segunda medición para validar la comparación anual y el siguiente consecutivo.
  -- Se crea después de la línea base aprobada para respetar la regla de secuencia.
  insert into public.economia_encuestas(
    id,project_id,family_id,ronda_id,fecha,cambio_num_personas,personas_ninos,personas_adolescentes,
    personas_jovenes,personas_adultos,personas_mayores,recibe_apoyo_gobierno,recibe_otros_pagos,
    valor_jornal,estado,observaciones,anio,tipo_medicion,numero_monitoreo,es_piloto
  ) values(
    'e2000000-0000-4000-8000-000000000102',v_project,'e0000000-0000-4000-8000-000000000002',coalesce(v_ronda_monitoreo1,v_ronda),
    '2027-02-10',false,2,1,1,2,1,true,true,90000,'aprobada','PILOTO / NO OFICIAL',2027,'monitoreo',1,true
  ) on conflict(id) do update set
    ronda_id=excluded.ronda_id,
    anio=excluded.anio,
    tipo_medicion=excluded.tipo_medicion,
    numero_monitoreo=excluded.numero_monitoreo,
    estado=excluded.estado,
    is_deleted=false,
    updated_at=now();

  if v_cat_product is not null then
    insert into public.economia_encuesta_productos(
      id,encuesta_id,project_id,family_id,producto_id,unidad,es_pecuario,temporalidad,
      cantidad_producida,consumo,vendido,precio_unitario,apoyo_act,motivo_no_venta
    ) values
    ('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',v_project,'e0000000-0000-4000-8000-000000000001',v_cat_product,'kg',false,'mensual',100,30,50,4000,true,null),
    ('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002',v_project,'e0000000-0000-4000-8000-000000000002',v_cat_product,'kg',false,'mensual',80,20,40,5000,false,null)
    on conflict(id) do nothing;
  end if;

  if v_cat_product is not null then
    insert into public.economia_encuesta_productos(id,encuesta_id,project_id,family_id,producto_id,unidad,es_pecuario,temporalidad,cantidad_producida,consumo,vendido,precio_unitario,apoyo_act,motivo_no_venta)
    values('e3000000-0000-4000-8000-000000000102','e2000000-0000-4000-8000-000000000102',v_project,'e0000000-0000-4000-8000-000000000002',v_cat_product,'kg',false,'mensual',110,20,70,5500,true,null)
    on conflict(id) do nothing;
  end if;

  -- Producto libre visible en ambos clientes.
  insert into public.economia_encuesta_productos(
    id,encuesta_id,project_id,family_id,producto_id,nombre_otro,unidad,es_pecuario,temporalidad,
    cantidad_producida,consumo,vendido,precio_unitario,apoyo_act,motivo_no_venta
  ) values(
    'e3000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000004',v_project,
    'e0000000-0000-4000-8000-000000000004',null,'Harina de yuca piloto','kg',false,'mensual',60,10,40,8000,true,null
  ) on conflict(id) do nothing;

  if v_lugar_venta is not null then
    insert into public.economia_producto_lugares_venta(id,encuesta_producto_id,project_id,family_id,lugar_venta_id)
    values
      ('e4000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',v_project,'e0000000-0000-4000-8000-000000000001',v_lugar_venta),
      ('e4000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000002',v_project,'e0000000-0000-4000-8000-000000000002',v_lugar_venta),
      ('e4000000-0000-4000-8000-000000000004','e3000000-0000-4000-8000-000000000004',v_project,'e0000000-0000-4000-8000-000000000004',v_lugar_venta),
      ('e4000000-0000-4000-8000-000000000102','e3000000-0000-4000-8000-000000000102',v_project,'e0000000-0000-4000-8000-000000000002',v_lugar_venta)
    on conflict(id) do update set lugar_venta_id=excluded.lugar_venta_id,is_deleted=false,updated_at=now();
  end if;
end $$;

notify pgrst, 'reload schema';
