-- Esta funcion solo se usa como trigger y no debe exponerse como RPC.
alter function public.set_audit_fields() set search_path = public;
revoke all on function public.set_audit_fields() from public, anon, authenticated;
