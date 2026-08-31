-- Impide que funciones SECURITY DEFINER privilegiadas sean endpoints anonimos.
revoke all on function public.generate_family_code(uuid) from public, anon;
revoke all on function public.recalculate_purchase_family_allocation(uuid) from public, anon, authenticated;
alter function public.sync_delivery_item_allocation() security definer;
alter function public.sync_delivery_item_allocation() set search_path = public;
revoke all on function public.sync_delivery_item_allocation() from public, anon, authenticated;

-- Los auxiliares de RLS deben estar disponibles solo para sesiones autenticadas.
revoke all on function public.current_profile_id() from public, anon;
revoke all on function public.has_project_role(uuid, text[]) from public, anon;
revoke all on function public.has_default_role(text[]) from public, anon;
revoke all on function public.is_project_member(uuid) from public, anon;
revoke all on function public.can_access_family(uuid) from public, anon;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_project_role(uuid, text[]) to authenticated;
grant execute on function public.has_default_role(text[]) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_access_family(uuid) to authenticated;

-- Estas funciones solamente se ejecutan como triggers; no son RPC publicas.
revoke all on function public.validate_phase5_delivery_act() from public, anon, authenticated;
revoke all on function public.validate_phase5_implementation_progress() from public, anon, authenticated;
revoke all on function public.validate_phase5_material_delivery() from public, anon, authenticated;
revoke all on function public.validate_phase5_material_delivery_item() from public, anon, authenticated;
revoke all on function public.validate_phase7_maintenance_progress() from public, anon, authenticated;
revoke all on function public.validate_phase7_quarterly_progress() from public, anon, authenticated;

grant execute on function public.generate_family_code(uuid) to authenticated;

create or replace function public.generate_family_code(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
  v_code text;
begin
  if auth.uid() is null or not (
    public.has_default_role(array['admin', 'super_admin'])
    or public.has_project_role(p_project_id, array['admin', 'coordinator', 'project_admin'])
  ) then
    raise exception 'No autorizado para generar codigos de familia'
      using errcode = '42501';
  end if;

  select code_prefix, next_family_number
    into v_prefix, v_next
  from public.projects
  where id = p_project_id and is_deleted = false
  for update;

  if v_prefix is null then
    raise exception 'Project % not found or inactive', p_project_id;
  end if;

  v_code := v_prefix || '-' || lpad(v_next::text, 4, '0');

  update public.projects
    set next_family_number = v_next + 1,
        updated_at = now(),
        updated_by = auth.uid()
  where id = p_project_id;

  return v_code;
end;
$$;

-- CREATE OR REPLACE vuelve a conceder EXECUTE a PUBLIC; se cierran los permisos al final.
revoke all on function public.generate_family_code(uuid) from public, anon;
grant execute on function public.generate_family_code(uuid) to authenticated;
