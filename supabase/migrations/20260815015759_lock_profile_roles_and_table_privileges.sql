-- Los clientes publicos no necesitan privilegios de tabla antes de autenticarse.
-- RLS no protege TRUNCATE, por eso se revoca explicitamente junto con permisos DDL-like.
revoke all privileges on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- Un usuario puede mantener sus datos de contacto, pero no promoverse, activarse,
-- desactivarse ni cambiar la identidad enlazada. Los administradores conservan la gestion.
create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.has_default_role(array['admin','super_admin'])
     and (
       new.auth_user_id is distinct from old.auth_user_id
       or new.default_role_id is distinct from old.default_role_id
       or new.active is distinct from old.active
       or new.is_deleted is distinct from old.is_deleted
     ) then
    raise exception 'No autorizado para modificar rol o estado del perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_authorization_fields() from public, anon, authenticated;

drop trigger if exists trg_protect_profile_authorization_fields on public.users_profiles;
create trigger trg_protect_profile_authorization_fields
before update of auth_user_id, default_role_id, active, is_deleted
on public.users_profiles
for each row execute function public.protect_profile_authorization_fields();

drop policy if exists profiles_insert_own on public.users_profiles;
create policy profiles_insert_own
on public.users_profiles for insert to authenticated
with check (
  public.has_default_role(array['admin','super_admin'])
  or (
    auth_user_id = auth.uid()
    and default_role_id is null
    and active = true
    and is_deleted = false
  )
);
