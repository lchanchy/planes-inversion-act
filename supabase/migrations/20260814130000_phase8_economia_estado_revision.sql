-- Fase 8: estados de revision para las encuestas de Economia Familiar.
-- Permite el flujo aprobar/devolver (como los planes operativos):
--   completada -> aprobada | devuelta (y devuelta se vuelve a editar y reenviar en la app).
-- Solo relaja el check del campo estado; no toca datos ni otras tablas.

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.economia_encuestas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table public.economia_encuestas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.economia_encuestas
  add constraint economia_encuestas_estado_check
  check (estado in ('borrador', 'completada', 'aprobada', 'devuelta', 'cerrada'));

notify pgrst, 'reload schema';
