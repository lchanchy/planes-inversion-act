-- Seeds minimos para Fase 1.
-- No crea usuarios de auth; los perfiles se asociaran cuando existan usuarios en Supabase Auth.

insert into public.roles (name, description, permissions)
values
  ('admin', 'Administrador del proyecto', '{"projects":"all","users":"all","catalogs":"all","plans":"approve","purchases":"all","documents":"all","reports":"all"}'),
  ('coordinator', 'Coordinador operativo', '{"projects":"assigned","families":"assigned","plans":"review","purchases":"assigned","documents":"assigned","reports":"assigned"}'),
  ('technician', 'Tecnico de campo', '{"projects":"assigned","families":"assigned","plans":"capture_offline","catalogs":"read","sync":"own"}'),
  ('viewer', 'Usuario de consulta', '{"read":"assigned"}'),
  ('auditor', 'Auditor de trazabilidad', '{"read":"assigned","audit":"read"}')
on conflict (name) do update
set description = excluded.description,
    permissions = excluded.permissions,
    updated_at = now();

insert into public.projects (
  id,
  name,
  code_prefix,
  department,
  intervention_zone,
  start_date,
  status,
  next_family_number,
  act_template_text
)
values (
  '00000000-0000-0000-0000-000000000101',
  'Proyecto Restauracion Ecologica Demo',
  'RE',
  'Demo',
  'Zona demo',
  current_date,
  'active',
  1,
  '{"title":"ACTA DE ENTREGA DE INSUMOS Y MATERIALES","footer":"Plantilla base editable por proyecto"}'::jsonb
)
on conflict (code_prefix) do update
set name = excluded.name,
    department = excluded.department,
    intervention_zone = excluded.intervention_zone,
    act_template_text = excluded.act_template_text,
    updated_at = now();

insert into public.municipalities (id, department, name)
values ('00000000-0000-0000-0000-000000000201', 'Demo', 'Municipio Demo')
on conflict (department, name) do nothing;

insert into public.villages (id, municipality_id, name)
values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'Vereda Demo')
on conflict (municipality_id, name) do nothing;

insert into public.activity_catalog (
  project_id,
  name,
  category,
  description,
  unit,
  indicator_type,
  requires_baseline,
  requires_target,
  allows_project_materials,
  allows_counterpart
)
values
  ('00000000-0000-0000-0000-000000000101', 'Aislamiento de areas de conservacion', 'Restauracion', 'Actividad base para cercado o aislamiento', 'metros lineales', 'physical', true, true, true, true),
  ('00000000-0000-0000-0000-000000000101', 'Siembra de arboles', 'Restauracion', 'Entrega y siembra de material vegetal', 'arboles', 'trees', true, true, true, true),
  ('00000000-0000-0000-0000-000000000101', 'Area bajo acuerdo de conservacion', 'Seguimiento', 'Seguimiento de area bajo acuerdo', 'hectareas', 'physical', true, true, false, false)
on conflict (project_id, name) do nothing;

insert into public.material_catalog (
  project_id,
  internal_code,
  name,
  category,
  unit,
  quoted_unit_price,
  price_updated_at,
  active
)
values
  ('00000000-0000-0000-0000-000000000101', 'MAT-001', 'Alambre de cerca calibre 14 rollo x 1000 metros', 'Cercas', 'rollo', 270000, current_date, true),
  ('00000000-0000-0000-0000-000000000101', 'MAT-002', 'Aislador poste madera x 25 unidades', 'Cercas', 'bolsa', 35000, current_date, true),
  ('00000000-0000-0000-0000-000000000101', 'MAT-003', 'Posta triangular 1.82 m', 'Cercas', 'unidad', 25000, current_date, true),
  ('00000000-0000-0000-0000-000000000101', 'MAT-004', 'Arbol forestal', 'Material vegetal', 'unidad', 3000, current_date, true)
on conflict (project_id, name, category, unit) do update
set quoted_unit_price = excluded.quoted_unit_price,
    price_updated_at = excluded.price_updated_at,
    active = excluded.active,
    updated_at = now();

insert into public.document_templates (project_id, type, name, content, active)
values (
  '00000000-0000-0000-0000-000000000101',
  'delivery_record',
  'Acta de entrega base',
  '{"title":"ACTA DE ENTREGA DE INSUMOS Y MATERIALES","sections":["datos_familia","texto_institucional","tabla_materiales","firmas"]}'::jsonb,
  true
)
on conflict do nothing;
