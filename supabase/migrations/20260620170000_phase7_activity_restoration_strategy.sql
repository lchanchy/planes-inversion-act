alter table public.activity_catalog
add column if not exists restoration_strategy text not null default 'no_aplica';

alter table public.activity_catalog
drop constraint if exists activity_catalog_restoration_strategy_check;

alter table public.activity_catalog
add constraint activity_catalog_restoration_strategy_check
check (restoration_strategy in (
  'restauracion_ecologica',
  'rehabilitacion_ecologica',
  'recuperacion_ecologica',
  'no_aplica'
));

create index if not exists idx_activity_catalog_restoration_strategy
on public.activity_catalog(restoration_strategy)
where is_deleted = false;
