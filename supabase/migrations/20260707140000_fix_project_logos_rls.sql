-- Fix: la politica de escritura de project_logos exigia rol POR DEFECTO = 'admin' exacto,
-- lo que bloqueaba a super_admin / project_admin / coordinadores de proyecto.
-- Los logos son configuracion de exportacion POR PROYECTO: debe poder gestionarlos
-- quien administra ese proyecto, o un administrador global.

drop policy if exists "project_logos_write_admin" on public.project_logos;

create policy "project_logos_write_admin"
on public.project_logos for all
using (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or public.has_default_role(array['admin', 'super_admin', 'project_admin'])
)
with check (
  public.has_project_role(project_id, array['admin', 'coordinator'])
  or public.has_default_role(array['admin', 'super_admin', 'project_admin'])
);
