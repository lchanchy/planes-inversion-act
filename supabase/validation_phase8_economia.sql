-- Ejecutar despues de las migraciones Fase 8. No persiste datos.
begin;

do $$
declare
  v_factor numeric;
begin
  -- La misma tabla de factores usada por Supabase/Android para evitar sobredimensionar.
  foreach v_factor in array array[365.0/12,52.0/12,2,1,1.0/3,1.0/6,1.0/12] loop
    if v_factor <= 0 then raise exception 'Factor de temporalidad invalido'; end if;
  end loop;
  if round((100 * 365.0/12)::numeric,2) <> 3041.67 then raise exception 'Conversion diaria incorrecta'; end if;
  if round((100 * 52.0/12)::numeric,2) <> 433.33 then raise exception 'Conversion semanal incorrecta'; end if;
  if round((100 / 12.0)::numeric,2) <> 8.33 then raise exception 'Conversion anual incorrecta'; end if;
end $$;

-- Estructura y seguridad mínimas del contrato.
do $$
begin
  if not exists(select 1 from pg_proc where proname='sync_economia_encuesta') then raise exception 'Falta RPC atomico'; end if;
  if not exists(select 1 from pg_indexes where indexname='economia_encuestas_familia_anio_live') then raise exception 'Falta unicidad anual'; end if;
  if not exists(select 1 from pg_class where relname='economia_reporte_familiar' and relkind='v') then raise exception 'Falta vista de reporte'; end if;
end $$;

rollback;
