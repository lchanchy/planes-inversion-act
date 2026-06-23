-- Fase 7: edicion web de planes y material vegetal de contrapartida familiar.
-- Migracion nueva; no modifica migraciones anteriores validadas.

alter table public.plan_family_counterparts
add column if not exists vegetal_indicator_group text;

alter table public.plan_family_counterparts
drop constraint if exists plan_family_counterparts_vegetal_group_check;

alter table public.plan_family_counterparts
add constraint plan_family_counterparts_vegetal_group_check
check (
  vegetal_indicator_group is null
  or vegetal_indicator_group in ('colinos', 'cacao', 'frutales', 'forestales_nativos', 'otro')
);

notify pgrst, 'reload schema';
