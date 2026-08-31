-- Historial automatico de cambios sensibles del aplicativo.
create schema if not exists private;

create or replace function private.capture_audit_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  row_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  row_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_data jsonb := coalesce(row_after, row_before);
  audit_project_id uuid;
  audit_entity_id uuid;
begin
  audit_entity_id := nullif(row_data ->> 'id', '')::uuid;
  audit_project_id := nullif(row_data ->> 'project_id', '')::uuid;

  if audit_project_id is null and row_data ? 'family_id' then
    select project_id into audit_project_id from public.families
    where id = nullif(row_data ->> 'family_id', '')::uuid;
  end if;
  if audit_project_id is null and row_data ? 'plan_id' then
    select project_id into audit_project_id from public.operational_plans
    where id = nullif(row_data ->> 'plan_id', '')::uuid;
  end if;
  if audit_project_id is null and row_data ? 'plan_activity_id' then
    select op.project_id into audit_project_id
    from public.plan_activities pa
    join public.operational_plans op on op.id = pa.plan_id
    where pa.id = nullif(row_data ->> 'plan_activity_id', '')::uuid;
  end if;

  insert into public.audit_logs(project_id, user_id, entity_type, entity_id, action, before_data, after_data)
  values (audit_project_id, public.current_profile_id(), tg_table_name, audit_entity_id, lower(tg_op), row_before, row_after);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.capture_audit_history() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'families', 'properties', 'operational_plans', 'plan_activities',
    'plan_project_materials', 'plan_family_counterparts',
    'procurement_batches', 'procurement_batch_items',
    'material_deliveries', 'material_delivery_items',
    'economia_encuestas', 'economia_encuesta_productos',
    'economia_encuesta_apoyos', 'economia_encuesta_pagos'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists capture_audit_history on public.%I', table_name);
      execute format(
        'create trigger capture_audit_history after insert or update or delete on public.%I for each row execute function private.capture_audit_history()',
        table_name
      );
    end if;
  end loop;
end $$;

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_created on public.audit_logs(user_id, created_at desc);

drop policy if exists "audit_logs_select_admin_coord_auditor" on public.audit_logs;
create policy "audit_logs_select_authorized"
on public.audit_logs for select
to authenticated
using (
  public.has_default_role(array['super_admin'])
  or (
    project_id is not null
    and public.has_project_role(project_id, array['admin', 'project_admin', 'coordinator', 'auditor'])
  )
);

revoke insert, update, delete on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
