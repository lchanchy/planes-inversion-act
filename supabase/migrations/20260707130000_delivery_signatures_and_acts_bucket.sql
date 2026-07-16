-- Fase 1/2/3: firmas de la entrega (dibujadas en la app) y bucket para las actas firmadas.

-- Firmas dibujadas, guardadas como data URI PNG base64 en la propia entrega
-- (livianas, sincronizan por el upsert REST que ya usa la app offline-first).
alter table public.material_deliveries
  add column if not exists family_signature text,
  add column if not exists technician_signature text;

-- Bucket privado para las actas firmadas en PDF (Fase 3 escribe aqui via service role).
insert into storage.buckets (id, name, public)
values ('actas', 'actas', false)
on conflict (id) do nothing;

-- El service role (usado por la funcion de Vercel) omite RLS de Storage,
-- por lo que no se requieren policies adicionales para la escritura del servidor.
