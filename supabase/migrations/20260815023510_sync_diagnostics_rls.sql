-- Diagnosticos de sincronizacion: el tecnico inserta los suyos y los roles de
-- supervision consultan solamente usuarios de sus proyectos.
create index if not exists idx_sync_logs_status_started on public.sync_logs(status, started_at desc);

drop policy if exists "sync_logs_own" on public.sync_logs;
drop policy if exists "sync_logs_select_scoped" on public.sync_logs;
drop policy if exists "sync_logs_insert_own" on public.sync_logs;

create policy "sync_logs_select_scoped"
on public.sync_logs for select
to authenticated
using (
  user_id = (select public.current_profile_id())
  or (select public.has_default_role(array['super_admin']))
  or exists (
    select 1
    from public.project_users viewer_membership
    join public.roles viewer_role on viewer_role.id = viewer_membership.role_id
    join public.project_users target_membership
      on target_membership.project_id = viewer_membership.project_id
     and target_membership.user_id = sync_logs.user_id
     and target_membership.status = 'active'
    where viewer_membership.user_id = (select public.current_profile_id())
      and viewer_membership.status = 'active'
      and viewer_role.name in ('admin', 'project_admin', 'coordinator', 'auditor')
  )
);

create policy "sync_logs_insert_own"
on public.sync_logs for insert
to authenticated
with check (user_id = (select public.current_profile_id()));

revoke update, delete on public.sync_logs from anon, authenticated;
grant select, insert on public.sync_logs to authenticated;
