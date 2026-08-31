-- Fase 8: Economia Familiar (monitoreo de ingresos economicos de las familias).
-- Modulo nuevo y AISLADO. No modifica ninguna tabla existente.
-- Reutiliza public.families como fuente unica de familias (y su geografia vereda/municipio/depto).
-- Convenciones del proyecto: UUID, auditoria, borrado logico (is_deleted) y RLS por proyecto/familia.

create extension if not exists "pgcrypto";

-- ==========================================================================
-- Tipos (valores fijos que casi nunca cambian)
-- ==========================================================================
do $$ begin
  create type public.economia_unidad_base as enum ('kg', 'animal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.economia_unidad as enum ('g', 'kg', 'litro', 'unidad');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.economia_temporalidad as enum ('diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual');
exception when duplicate_object then null; end $$;

-- ==========================================================================
-- Catalogos (globales, editables desde la web por admin)
-- ==========================================================================
create table if not exists public.economia_equipos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.economia_encuestadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  documento text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.economia_rondas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.economia_categorias (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.economia_productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.economia_categorias(id) on delete restrict,
  codigo text not null unique,
  nombre text not null,
  es_pecuario boolean not null default false,
  unidad_base public.economia_unidad_base not null default 'kg',
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.economia_tipos_apoyo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.economia_tipos_pago (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

create table if not exists public.economia_lugares_venta (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false
);

-- ==========================================================================
-- Marcador de familias que participan en Economia Familiar.
-- Apunta a la familia REAL (public.families); NO duplica datos ni geografia.
-- Permite incluir familias que no tienen plan de inversion.
-- ==========================================================================
create table if not exists public.economia_familias (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint economia_familias_family_unique unique (family_id)
);

-- ==========================================================================
-- Captura: una encuesta por familia por ronda
-- ==========================================================================
create table if not exists public.economia_encuestas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  ronda_id uuid not null references public.economia_rondas(id) on delete restrict,
  equipo_id uuid references public.economia_equipos(id) on delete set null,
  encuestador_id uuid references public.economia_encuestadores(id) on delete set null,
  fecha date not null default current_date,
  cambio_num_personas boolean,
  personas_ninos integer check (personas_ninos is null or personas_ninos >= 0),
  personas_adolescentes integer check (personas_adolescentes is null or personas_adolescentes >= 0),
  personas_jovenes integer check (personas_jovenes is null or personas_jovenes >= 0),
  personas_adultos integer check (personas_adultos is null or personas_adultos >= 0),
  personas_mayores integer check (personas_mayores is null or personas_mayores >= 0),
  personas_total integer generated always as (
    coalesce(personas_ninos,0) + coalesce(personas_adolescentes,0) + coalesce(personas_jovenes,0)
    + coalesce(personas_adultos,0) + coalesce(personas_mayores,0)
  ) stored,
  recibe_apoyo_gobierno boolean,
  recibe_otros_pagos boolean,
  valor_jornal numeric(14,2) check (valor_jornal is null or valor_jornal >= 0),
  estado text not null default 'completada' check (estado in ('borrador', 'completada')),
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint economia_encuestas_familia_ronda_unique unique (family_id, ronda_id)
);

create table if not exists public.economia_encuesta_apoyos (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.economia_encuestas(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  tipo_apoyo_id uuid not null references public.economia_tipos_apoyo(id) on delete restrict,
  valor_mensual numeric(14,2) check (valor_mensual is null or valor_mensual >= 0),
  nombre_libre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint economia_encuesta_apoyos_unique unique (encuesta_id, tipo_apoyo_id)
);

create table if not exists public.economia_encuesta_pagos (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.economia_encuestas(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  tipo_pago_id uuid not null references public.economia_tipos_pago(id) on delete restrict,
  valor_mensual numeric(14,2) check (valor_mensual is null or valor_mensual >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint economia_encuesta_pagos_unique unique (encuesta_id, tipo_pago_id)
);

create table if not exists public.economia_encuesta_productos (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.economia_encuestas(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  producto_id uuid references public.economia_productos(id) on delete restrict,
  nombre_otro text,
  unidad public.economia_unidad,
  es_pecuario boolean not null default false,
  temporalidad public.economia_temporalidad,
  cantidad_producida numeric(14,2) check (cantidad_producida is null or cantidad_producida >= 0),
  consumo numeric(14,2) check (consumo is null or consumo >= 0),
  vendido numeric(14,2) check (vendido is null or vendido >= 0),
  motivo_no_venta text,
  precio_unitario numeric(14,2) check (precio_unitario is null or precio_unitario >= 0),
  ingreso_mensual numeric(16,2) generated always as (
    coalesce(vendido,0) * coalesce(precio_unitario,0)
  ) stored,
  apoyo_act boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint economia_encuesta_productos_ref_check check (producto_id is not null or nombre_otro is not null)
);

create table if not exists public.economia_producto_lugares_venta (
  id uuid primary key default gen_random_uuid(),
  encuesta_producto_id uuid not null references public.economia_encuesta_productos(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  family_id uuid not null references public.families(id) on delete restrict,
  lugar_venta_id uuid not null references public.economia_lugares_venta(id) on delete restrict,
  nombre_libre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  is_deleted boolean not null default false,
  constraint economia_producto_lugares_venta_unique unique (encuesta_producto_id, lugar_venta_id)
);

-- ==========================================================================
-- Indices
-- ==========================================================================
create index if not exists idx_economia_productos_categoria on public.economia_productos(categoria_id);
create index if not exists idx_economia_familias_project on public.economia_familias(project_id);
create index if not exists idx_economia_familias_family on public.economia_familias(family_id);
create index if not exists idx_economia_encuestas_project on public.economia_encuestas(project_id);
create index if not exists idx_economia_encuestas_family on public.economia_encuestas(family_id);
create index if not exists idx_economia_encuestas_ronda on public.economia_encuestas(ronda_id);
create index if not exists idx_economia_enc_apoyos_encuesta on public.economia_encuesta_apoyos(encuesta_id);
create index if not exists idx_economia_enc_apoyos_family on public.economia_encuesta_apoyos(family_id);
create index if not exists idx_economia_enc_pagos_encuesta on public.economia_encuesta_pagos(encuesta_id);
create index if not exists idx_economia_enc_pagos_family on public.economia_encuesta_pagos(family_id);
create index if not exists idx_economia_enc_productos_encuesta on public.economia_encuesta_productos(encuesta_id);
create index if not exists idx_economia_enc_productos_family on public.economia_encuesta_productos(family_id);
create index if not exists idx_economia_enc_productos_producto on public.economia_encuesta_productos(producto_id);
create index if not exists idx_economia_prod_lugares_prod on public.economia_producto_lugares_venta(encuesta_producto_id);
create index if not exists idx_economia_prod_lugares_family on public.economia_producto_lugares_venta(family_id);

-- ==========================================================================
-- RLS
-- ==========================================================================
alter table public.economia_equipos enable row level security;
alter table public.economia_encuestadores enable row level security;
alter table public.economia_rondas enable row level security;
alter table public.economia_categorias enable row level security;
alter table public.economia_productos enable row level security;
alter table public.economia_tipos_apoyo enable row level security;
alter table public.economia_tipos_pago enable row level security;
alter table public.economia_lugares_venta enable row level security;
alter table public.economia_familias enable row level security;
alter table public.economia_encuestas enable row level security;
alter table public.economia_encuesta_apoyos enable row level security;
alter table public.economia_encuesta_pagos enable row level security;
alter table public.economia_encuesta_productos enable row level security;
alter table public.economia_producto_lugares_venta enable row level security;

-- Catalogos: lectura para cualquier usuario autenticado; escritura solo admin/super_admin.
do $$
declare t text;
begin
  foreach t in array array[
    'economia_equipos','economia_encuestadores','economia_rondas','economia_categorias',
    'economia_productos','economia_tipos_apoyo','economia_tipos_pago','economia_lugares_venta'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_select_auth', t);
    execute format('create policy %I on public.%I for select using (auth.uid() is not null)', t||'_select_auth', t);
    execute format('drop policy if exists %I on public.%I', t||'_write_admin', t);
    execute format('create policy %I on public.%I for all using (public.has_default_role(array[''admin'',''super_admin''])) with check (public.has_default_role(array[''admin'',''super_admin'']))', t||'_write_admin', t);
  end loop;
end $$;

-- economia_familias (marcador): ve quien puede ver la familia; edita admin/coordinador del proyecto.
drop policy if exists "economia_familias_select_scoped" on public.economia_familias;
create policy "economia_familias_select_scoped"
on public.economia_familias for select
using (public.can_access_family(family_id));

drop policy if exists "economia_familias_write_admin_coord" on public.economia_familias;
create policy "economia_familias_write_admin_coord"
on public.economia_familias for all
using (public.has_project_role(project_id, array['admin', 'coordinator']))
with check (public.has_project_role(project_id, array['admin', 'coordinator']));

-- Tablas de captura: mismo patron que entregas.
-- SELECT: quien puede acceder a la familia.
-- INSERT/UPDATE: admin/coordinador, o tecnico sobre sus familias asignadas.
-- DELETE: admin/coordinador, o tecnico sobre sus familias asignadas (para re-sincronizar).
do $$
declare t text;
begin
  foreach t in array array[
    'economia_encuestas','economia_encuesta_apoyos','economia_encuesta_pagos',
    'economia_encuesta_productos','economia_producto_lugares_venta'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_select_scoped', t);
    execute format('create policy %I on public.%I for select using (public.can_access_family(family_id))', t||'_select_scoped', t);

    execute format('drop policy if exists %I on public.%I', t||'_insert_scoped', t);
    execute format('create policy %I on public.%I for insert with check (public.has_project_role(project_id, array[''admin'',''coordinator'']) or (public.has_project_role(project_id, array[''technician'']) and public.can_access_family(family_id)))', t||'_insert_scoped', t);

    execute format('drop policy if exists %I on public.%I', t||'_update_scoped', t);
    execute format('create policy %I on public.%I for update using (public.has_project_role(project_id, array[''admin'',''coordinator'']) or (public.has_project_role(project_id, array[''technician'']) and public.can_access_family(family_id))) with check (public.has_project_role(project_id, array[''admin'',''coordinator'']) or (public.has_project_role(project_id, array[''technician'']) and public.can_access_family(family_id)))', t||'_update_scoped', t);

    execute format('drop policy if exists %I on public.%I', t||'_delete_scoped', t);
    execute format('create policy %I on public.%I for delete using (public.has_project_role(project_id, array[''admin'',''coordinator'']) or (public.has_project_role(project_id, array[''technician'']) and public.can_access_family(family_id)))', t||'_delete_scoped', t);
  end loop;
end $$;

-- Grants (RLS sigue gobernando el acceso fila a fila).
grant select, insert, update, delete on public.economia_equipos to authenticated;
grant select, insert, update, delete on public.economia_encuestadores to authenticated;
grant select, insert, update, delete on public.economia_rondas to authenticated;
grant select, insert, update, delete on public.economia_categorias to authenticated;
grant select, insert, update, delete on public.economia_productos to authenticated;
grant select, insert, update, delete on public.economia_tipos_apoyo to authenticated;
grant select, insert, update, delete on public.economia_tipos_pago to authenticated;
grant select, insert, update, delete on public.economia_lugares_venta to authenticated;
grant select, insert, update, delete on public.economia_familias to authenticated;
grant select, insert, update, delete on public.economia_encuestas to authenticated;
grant select, insert, update, delete on public.economia_encuesta_apoyos to authenticated;
grant select, insert, update, delete on public.economia_encuesta_pagos to authenticated;
grant select, insert, update, delete on public.economia_encuesta_productos to authenticated;
grant select, insert, update, delete on public.economia_producto_lugares_venta to authenticated;

-- ==========================================================================
-- Semilla de catalogos (idempotente)
-- ==========================================================================
insert into public.economia_equipos (codigo, nombre, orden) values
  ('caqueta', 'Caqueta', 1),
  ('amazonas', 'Amazonas', 2),
  ('sierra', 'Sierra', 3),
  ('putumayo', 'Putumayo', 4)
on conflict (codigo) do nothing;

insert into public.economia_encuestadores (nombre) values
  ('Alexander Meneses'),
  ('Alexis García'),
  ('Cristobal Navarro'),
  ('Daniel Villamil'),
  ('Diana Libreros'),
  ('Edgar Núñez'),
  ('Emilso Ramón Marín'),
  ('Fernando Cantillo'),
  ('Ferney Sierra Ospina'),
  ('Gonzalo Gómez'),
  ('Jhoan Sebastián Calderón'),
  ('John Fredy Sabogal'),
  ('Julieth Karina Navarro López'),
  ('Leonel García'),
  ('Libardo Díaz'),
  ('Paola Aguilar'),
  ('Patricia Navarrete'),
  ('Pedro Jiménez'),
  ('Santiago Toro'),
  ('Saúl Gutiérrez'),
  ('Ubency Cerquera'),
  ('Wilfredo Horta'),
  ('Wilmer Silva'),
  ('Yendy Cantillo'),
  ('Ejemplo Sierra 1'),
  ('Ejemplo Sierra 2'),
  ('Celene Paz'),
  ('Sandra Patiño'),
  ('Iván Gómez Gómez'),
  ('Iván Ibarra Robledo'),
  ('Camilo Sabogal Jurado'),
  ('Yuri Tatiana Cabrera Hernández'),
  ('Merly Ducuara'),
  ('Migel Ángel Sinarahua'),
  ('Teresa Garces'),
  ('Julieta Rimavake Yacob'),
  ('Frecia Lopez Kumimarima'),
  ('Jesus Alberto Huyuedo Uaroke'),
  ('Paula Andrea Kuyuedo')
on conflict (nombre) do nothing;

insert into public.economia_rondas (codigo, nombre, orden) values
  ('linea_base', 'Línea base', 1),
  ('monitoreo_1', 'Monitoreo 1', 2),
  ('monitoreo_2', 'Monitoreo 2', 3),
  ('monitoreo_3', 'Monitoreo 3', 4)
on conflict (codigo) do nothing;

insert into public.economia_categorias (codigo, nombre, orden) values
  ('agricolas_cultivos', 'Agrícolas / Cultivos', 1),
  ('alimenticios', 'Productos transformados alimenticios', 2),
  ('artesania', 'Artesanías', 3),
  ('aseo', 'Aseo personal y hogar', 4),
  ('medicinales', 'Medicinales', 5),
  ('pecuario', 'Pecuario y especies menores', 6)
on conflict (codigo) do nothing;

insert into public.economia_tipos_apoyo (codigo, nombre, orden) values
  ('atencion_unidad_victimas', 'Atención Humanitaria de la Unidad para las Víctimas', 1),
  ('colombia_mayor', 'Colombia Mayor', 2),
  ('empren_colectivos', 'Emprendimientos Colectivos', 3),
  ('familias_accion', 'Familias en Acción', 4),
  ('ingreso_solidario', 'Ingreso Solidario', 5),
  ('jovenes_accion', 'Jóvenes en Acción', 6),
  ('mi_negocio', 'Mi Negocio', 7),
  ('otro', 'Otro', 8),
  ('resa', 'RESA', 9)
on conflict (codigo) do nothing;

insert into public.economia_tipos_pago (codigo, nombre, orden) values
  ('arriendos', 'Arriendos, herencias o pensiones', 1),
  ('cuota_alimentos', 'Por cuota de alimentos o cuota alimentaria', 2),
  ('familiares_amigos', 'De familiares o amigos que viven fuera del hogar', 3),
  ('fundaciones', 'De ONGs, fundaciones, organismos internacionales, iglesia u otras organizaciones', 4)
on conflict (codigo) do nothing;

insert into public.economia_lugares_venta (codigo, nombre, orden) values
  ('cabecera_municipal', 'Cabecera municipal', 1),
  ('ciudades_principales', 'Ciudades principales', 2),
  ('empresa_transformación', 'Empresa para transformación', 3),
  ('en_vereda', 'En la misma comunidad o vereda', 4),
  ('fuera_país', 'Fuera del país', 5),
  ('otras_comunidades', 'Otras comunidades', 6),
  ('otro', 'Otro', 7)
on conflict (codigo) do nothing;

insert into public.economia_productos (categoria_id, codigo, nombre, es_pecuario, unidad_base, orden)
select c.id, v.codigo, v.nombre, v.es_pecuario, v.unidad_base::public.economia_unidad_base, v.orden
from (values
  ('agricolas_cultivos', 'aguacate', 'Aguacate', false, 'kg', 1),
  ('agricolas_cultivos', 'araza', 'Araza', false, 'kg', 2),
  ('agricolas_cultivos', 'arroz', 'Arroz', false, 'kg', 3),
  ('agricolas_cultivos', 'asai', 'Asaí', false, 'kg', 4),
  ('agricolas_cultivos', 'cacao', 'Cacao', false, 'kg', 5),
  ('agricolas_cultivos', 'cafee', 'Café', false, 'kg', 6),
  ('agricolas_cultivos', 'caimo', 'Caimo', false, 'kg', 7),
  ('agricolas_cultivos', 'castano', 'Nuez de Castaño', false, 'kg', 8),
  ('agricolas_cultivos', 'chontaduro', 'Chontaduro', false, 'kg', 9),
  ('agricolas_cultivos', 'cocona', 'Cocona', false, 'kg', 10),
  ('agricolas_cultivos', 'Copoazu', 'Copoazú', false, 'kg', 11),
  ('agricolas_cultivos', 'guamo', 'Guamo', false, 'kg', 12),
  ('agricolas_cultivos', 'guanabana', 'Guanabana', false, 'kg', 13),
  ('agricolas_cultivos', 'hortalizas', 'Hortalizas', false, 'kg', 14),
  ('agricolas_cultivos', 'limon', 'Limón', false, 'kg', 15),
  ('agricolas_cultivos', 'Limon_Mandarino', 'Limón Mandarino', false, 'kg', 16),
  ('agricolas_cultivos', 'Limon_Pajarito', 'Limón Pajarito', false, 'kg', 17),
  ('agricolas_cultivos', 'Limon_Tahití', 'Limón Tahití', false, 'kg', 18),
  ('agricolas_cultivos', 'maiz', 'Maíz', false, 'kg', 19),
  ('agricolas_cultivos', 'mandarina', 'Mandarina', false, 'kg', 20),
  ('agricolas_cultivos', 'naranja', 'Naranja', false, 'kg', 21),
  ('agricolas_cultivos', 'papa', 'Papa', false, 'kg', 22),
  ('agricolas_cultivos', 'papaya', 'Papaya', false, 'kg', 23),
  ('agricolas_cultivos', 'pildoro', 'Píldoro', false, 'kg', 24),
  ('agricolas_cultivos', 'pina', 'Piña', false, 'kg', 25),
  ('agricolas_cultivos', 'plantulas', 'Producción de plántulas', false, 'kg', 26),
  ('agricolas_cultivos', 'platano', 'Plátano', false, 'kg', 27),
  ('agricolas_cultivos', 'sacha_inchi', 'Sacha inchi', false, 'kg', 28),
  ('agricolas_cultivos', 'uva_caimarona', 'Uva caimarona', false, 'kg', 29),
  ('agricolas_cultivos', 'yuca', 'Yuca', false, 'kg', 30),
  ('agricolas_cultivos', 'zapote', 'Zapote', false, 'kg', 31),
  ('aseo', 'champu', 'Champú', false, 'kg', 32),
  ('aseo', 'fabuloso', 'Fabuloso', false, 'kg', 33),
  ('aseo', 'jabon_azul', 'Jabón Azul', false, 'kg', 34),
  ('aseo', 'jabon_bano', 'Jabón de baño', false, 'kg', 35),
  ('aseo', 'limpia_pisos', 'Limpia pisos', false, 'kg', 36),
  ('aseo', 'talco', 'Talco', false, 'kg', 37),
  ('medicinales', 'jarabe', 'Jarabe', false, 'kg', 38),
  ('medicinales', 'pomada', 'Pomada', false, 'kg', 39),
  ('pecuario', 'cerdos', 'Cerdos', true, 'animal', 40),
  ('pecuario', 'conejos', 'Conejos', true, 'animal', 41),
  ('pecuario', 'cuyes', 'Cuyes', true, 'animal', 42),
  ('pecuario', 'ganado', 'Ganado', true, 'animal', 43),
  ('pecuario', 'huevos', 'Huevos', true, 'animal', 44),
  ('pecuario', 'leche', 'Leche', true, 'animal', 45),
  ('pecuario', 'miel', 'Miel de abejas', true, 'animal', 46),
  ('pecuario', 'patos', 'Patos', true, 'animal', 47),
  ('pecuario', 'peces', 'Peces', true, 'animal', 48),
  ('pecuario', 'pollos', 'Pollos de engorde', true, 'animal', 49),
  ('alimenticios', 'Aceite_Castaño', 'Aceite de Castaño', false, 'kg', 50),
  ('alimenticios', 'Aceite_Coco', 'Aceite de Coco', false, 'kg', 51),
  ('alimenticios', 'aceite_milpes', 'Aceite de milpes', false, 'kg', 52),
  ('alimenticios', 'aji_negro', 'Ají Negro', false, 'kg', 53),
  ('alimenticios', 'aji_polvo', 'Ají en polvo', false, 'kg', 54),
  ('alimenticios', 'Chocolate', 'Chocolate', false, 'kg', 55),
  ('alimenticios', 'Envueltos', 'Envueltos', false, 'kg', 56),
  ('alimenticios', 'Harina_Chontaduro', 'Harina de Chontaduro', false, 'kg', 57),
  ('alimenticios', 'Harina_Platano', 'Harina de Plátano', false, 'kg', 58),
  ('alimenticios', 'mermelada', 'Mermelada', false, 'kg', 59),
  ('alimenticios', 'Miel_Caña', 'Miel de Caña', false, 'kg', 60),
  ('alimenticios', 'multimezcla', 'Multimezcla', false, 'kg', 61),
  ('alimenticios', 'panela', 'Panela', false, 'kg', 62),
  ('alimenticios', 'queso', 'Queso', false, 'kg', 63),
  ('alimenticios', 'Tortas', 'Tortas', false, 'kg', 64),
  ('alimenticios', 'vino', 'Vino', false, 'kg', 65),
  ('alimenticios', 'Yogurth', 'Yogurth', false, 'kg', 66),
  ('artesania', 'artesania', 'Artesanía (opción texto abierta)', false, 'kg', 67),
  ('artesania', 'cestos', 'Cestos', false, 'kg', 68)
) as v(cat_codigo, codigo, nombre, es_pecuario, unidad_base, orden)
join public.economia_categorias c on c.codigo = v.cat_codigo
on conflict (codigo) do nothing;

notify pgrst, 'reload schema';
