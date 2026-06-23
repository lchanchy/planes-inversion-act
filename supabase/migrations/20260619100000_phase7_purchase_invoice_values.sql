-- Fase 7: datos reales de factura y compra.
-- Amplia tablas de Fase 5 sin modificar migraciones ya validadas.

alter table public.procurement_batches
  add column if not exists purchase_number integer,
  add column if not exists supplier_name text,
  add column if not exists invoice_number text,
  add column if not exists invoice_date date,
  add column if not exists purchase_observations text;

alter table public.procurement_batch_items
  add column if not exists quoted_unit_price numeric(14,2),
  add column if not exists quoted_total_value numeric(14,2),
  add column if not exists invoice_quantity numeric(14,2) default 0 check (invoice_quantity >= 0),
  add column if not exists purchase_unit_price numeric(14,2) default 0 check (purchase_unit_price >= 0),
  add column if not exists purchase_total_value numeric(14,2) default 0 check (purchase_total_value >= 0);

update public.procurement_batch_items
set
  quoted_unit_price = coalesce(quoted_unit_price, unit_price),
  quoted_total_value = coalesce(quoted_total_value, required_quantity * unit_price)
where quoted_unit_price is null
   or quoted_total_value is null;

with numbered as (
  select
    id,
    row_number() over (partition by project_id order by created_at, id) as generated_number
  from public.procurement_batches
  where purchase_number is null
)
update public.procurement_batches batch
set purchase_number = numbered.generated_number
from numbered
where batch.id = numbered.id;

create index if not exists idx_procurement_batches_project_purchase_number
on public.procurement_batches(project_id, purchase_number);

create index if not exists idx_procurement_batches_invoice_number
on public.procurement_batches(invoice_number);
