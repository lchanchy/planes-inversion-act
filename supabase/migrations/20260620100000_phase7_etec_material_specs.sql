alter table public.material_catalog
  add column if not exists etec_block text,
  add column if not exists technical_characteristics text;

alter table public.procurement_batch_items
  add column if not exists etec_block text,
  add column if not exists technical_characteristics text;

create index if not exists idx_material_catalog_etec_block
  on public.material_catalog (project_id, etec_block)
  where is_deleted = false;

notify pgrst, 'reload schema';
