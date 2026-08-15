-- Evita que un reintento de red cree varias filas para el mismo conflicto local.
delete from public.economia_sync_conflictos a
using public.economia_sync_conflictos b
where a.estado = 'pendiente' and b.estado = 'pendiente'
  and a.encuesta_id = b.encuesta_id
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists economia_conflicto_pendiente_por_encuesta
  on public.economia_sync_conflictos(encuesta_id) where estado = 'pendiente';

-- V2 conserva el RPC atomico existente y convierte una colision por ano/secuencia
-- (dos telefonos offline) en un conflicto revisable, en vez de devolver un 23505 opaco.
create or replace function public.sync_economia_encuesta_v2(
  p_encuesta jsonb, p_apoyos jsonb default '[]', p_pagos jsonb default '[]',
  p_productos jsonb default '[]', p_expected_version bigint default 0
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_result jsonb;
  v_server public.economia_encuestas%rowtype;
  v_client_id uuid := (p_encuesta->>'id')::uuid;
begin
  begin
    select public.sync_economia_encuesta(
      p_encuesta, p_apoyos, p_pagos, p_productos, p_expected_version
    ) into v_result;
    return v_result;
  exception when unique_violation then
    select e.* into v_server
    from public.economia_encuestas e
    where e.family_id = (p_encuesta->>'family_id')::uuid
      and not e.is_deleted
      and (
        e.anio = (p_encuesta->>'anio')::smallint
        or (e.tipo_medicion = 'linea_base' and p_encuesta->>'tipo_medicion' = 'linea_base')
        or (e.tipo_medicion = 'monitoreo'
            and p_encuesta->>'tipo_medicion' = 'monitoreo'
            and e.numero_monitoreo = (p_encuesta->>'numero_monitoreo')::integer)
      )
    order by e.updated_at desc
    limit 1;

    if not found then
      raise;
    end if;

    insert into public.economia_sync_conflictos(
      encuesta_id, project_id, family_id, expected_version, current_version,
      server_payload, client_payload
    ) values (
      v_client_id, v_server.project_id, v_server.family_id, p_expected_version,
      v_server.server_version, to_jsonb(v_server),
      jsonb_build_object('encuesta',p_encuesta,'apoyos',p_apoyos,'pagos',p_pagos,'productos',p_productos)
    )
    on conflict (encuesta_id) where estado = 'pendiente'
    do update set
      current_version = excluded.current_version,
      server_payload = excluded.server_payload,
      client_payload = excluded.client_payload,
      created_at = now();

    return jsonb_build_object(
      'id', v_client_id, 'conflict', true,
      'server_version', v_server.server_version,
      'revision', v_server.revision, 'estado', 'conflicto'
    );
  end;
end;
$$;

revoke all on function public.sync_economia_encuesta_v2(jsonb,jsonb,jsonb,jsonb,bigint) from public, anon;
grant execute on function public.sync_economia_encuesta_v2(jsonb,jsonb,jsonb,jsonb,bigint) to authenticated;

notify pgrst, 'reload schema';
