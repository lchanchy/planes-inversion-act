# QA final - Version estable 1.0

## Preparacion

- [ ] Supabase remoto tiene migraciones aplicadas.
- [ ] `seed.sql` fue ejecutado.
- [ ] Existe usuario de prueba en Supabase Auth.
- [ ] Existe perfil en `users_profiles`.
- [ ] El perfil esta asignado en `project_users`.
- [ ] El tecnico tiene familias asignadas en `family_assignments`, si aplica.
- [ ] Web tiene `apps/web/.env.local`.
- [ ] Android tiene `apps/android/local.properties`.

## Login web

- [ ] Abrir `http://localhost:3000`.
- [ ] Iniciar sesion con usuario admin/coordinador.
- [ ] Ver dashboard con datos reales.
- [ ] Confirmar rol visible.
- [ ] Confirmar que no aparecen errores de Supabase/RLS.

## Web administrativa

- [ ] Crear/editar proyecto.
- [ ] Asignar varios departamentos, municipios y veredas.
- [ ] Crear/editar usuario o perfil.
- [ ] Crear/editar familia.
- [ ] Cargar familias desde CSV/Excel.
- [ ] Crear/editar actividades.
- [ ] Cargar actividades desde CSV/Excel.
- [ ] Crear/editar materiales.
- [ ] Cargar materiales desde CSV/Excel.
- [ ] Crear/editar catalogo de contrapartidas.

## Login Android

- [ ] Instalar app Android.
- [ ] Ver nombre visible "Planes Operativos".
- [ ] Ver logo institucional en login.
- [ ] Iniciar sesion con usuario valido.
- [ ] Descargar datos iniciales.
- [ ] Confirmar proyectos asignados.
- [ ] Confirmar familias asignadas.
- [ ] Confirmar catalogos de actividades, materiales y contrapartidas.

## Captura offline

- [ ] Activar modo avion despues de descargar datos.
- [ ] Seleccionar proyecto.
- [ ] Buscar familia por nombre, codigo o documento.
- [ ] Seleccionar familia y ver municipio/vereda con nombres legibles.
- [ ] Crear o continuar plan.
- [ ] Agregar actividad.
- [ ] Registrar linea base y meta.
- [ ] Agregar dos materiales del proyecto.
- [ ] Agregar contrapartida familiar.
- [ ] Ver resumen con subtotales y total general.
- [ ] Guardar borrador offline.
- [ ] Cerrar y abrir app.
- [ ] Confirmar que el plan local no se perdio.

## Sincronizacion

- [ ] Reactivar internet.
- [ ] Presionar enviar/sincronizar.
- [ ] Confirmar que no aparece error de serializacion.
- [ ] Confirmar estado sincronizado o mensaje claro si falla.
- [ ] Abrir web y verificar que el plan aparece.

## Revision web

- [ ] Abrir Planes Operativos.
- [ ] Filtrar por proyecto.
- [ ] Filtrar por municipio.
- [ ] Filtrar por vereda.
- [ ] Abrir detalle del plan.
- [ ] Ver actividades con linea base/meta.
- [ ] Ver materiales del proyecto.
- [ ] Ver contrapartida familiar.
- [ ] Devolver plan.
- [ ] Confirmar que vuelve a estado devuelto.
- [ ] Aprobar plan valido.
- [ ] Confirmar que no se aprueba un plan incompleto.
- [ ] Confirmar que no se aprueba si hay material provisional pendiente.

## Exportacion PDF/Word

- [ ] Exportar PDF individual de un plan.
- [ ] Guardar como PDF desde la ventana imprimible.
- [ ] Ver encabezado con proyecto, familia, documento, municipio, vereda, fecha y estado.
- [ ] Ver actividades agrupadas.
- [ ] Ver aporte de familia.
- [ ] Ver aporte del proyecto.
- [ ] Ver subtotales y total general.
- [ ] Exportar Word individual.
- [ ] Abrir Word y confirmar tablas y totales.
- [ ] Aplicar filtro por vereda y exportar visibles.
- [ ] Aplicar filtro por municipio y exportar visibles.
- [ ] Aplicar filtro por proyecto y exportar visibles.

## Resultado esperado

- [ ] Web funcional sin errores criticos.
- [ ] Android funcional sin errores criticos.
- [ ] Offline-first validado.
- [ ] Sincronizacion validada.
- [ ] Revision administrativa validada.
- [ ] Exportacion PDF/Word validada.

## Estado final

VERSION ESTABLE 1.0 LISTA PARA RESPALDO Y CONTROL DE CAMBIOS.
