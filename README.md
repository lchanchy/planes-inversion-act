# Planes Operativos

Sistema multi-proyecto para administrar planes operativos de campo en proyectos de restauracion ecologica.

## Arquitectura

- Base central: Supabase/PostgreSQL.
- Seguridad: Supabase Auth, Row Level Security, roles por proyecto y familias asignadas.
- Web administrativa: Next.js + React + TypeScript.
- App movil: Android nativo con Kotlin, Jetpack Compose y Room.
- Enfoque movil: offline-first real para captura en campo.
- Identificadores: UUID.
- Auditoria: campos `created_at`, `updated_at`, `created_by`, `updated_by`, `is_deleted` o equivalentes en tablas criticas.
- Costos: sin servidor propio al inicio; Supabase + despliegue web simple en Vercel/Netlify.

## Fases implementadas

1. Supabase/PostgreSQL
   - Migraciones SQL versionadas.
   - Tablas principales, llaves foraneas, indices, restricciones y RLS.
   - `project_users` y `family_assignments`.
   - RPC transaccional `generate_family_code(project_id)`.
   - Seeds minimos y validacion SQL.

2. Web administrativa base
   - Login con Supabase Auth.
   - Dashboard basico.
   - CRUD de proyectos, usuarios/perfiles, familias, actividades, materiales y contrapartidas.
   - Carga CSV/Excel basica para familias y catalogos.
   - Selector territorial multi-departamento, municipio y vereda.

3. Planes operativos web
   - Listado y filtros por proyecto, familia, municipio, vereda y estado.
   - Detalle administrativo del plan.
   - Revision, aprobacion, devolucion y cierre.
   - Validaciones para aprobacion y materiales provisionales.

4. App Android offline-first
   - Login y descarga inicial.
   - Seleccion de proyecto y familia.
   - Captura offline de actividades, linea base, meta, materiales y contrapartida familiar.
   - Guardado local con Room.
   - Estados `PENDING_SYNC`, `SYNCED`, `ERROR`, `CONFLICT`.
   - Sincronizacion con Supabase.
   - UX/UI con identidad "Planes Operativos".

5. Exportacion web de planes operativos
   - Exportacion individual y masiva de planes visibles.
   - Formatos PDF imprimible y Word compatible.
   - Agrupacion por actividad.
   - Tablas de aporte de familia y aporte del proyecto.
   - Subtotales y total general.

## Supabase

Ejecutar en Supabase SQL Editor o con la CLI, en este orden:

```text
supabase/migrations/20260610220000_initial_schema.sql
supabase/seed.sql
supabase/validation_phase1.sql
supabase/migrations/20260610230000_project_territories.sql
supabase/migrations/20260611100000_ensure_counterpart_catalog.sql
```

La Fase 1 ya fue validada con resultado:

```text
FASE 1 VALIDADA EN SQL
```

## Variables de entorno

### Web

Crear `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xvmgmsexzibdqptmvzdn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...legacy-anon-key...
```

La key debe ser la Legacy anon key de Supabase, no la `sb_publishable_`.

### Android

Crear `apps/android/local.properties`:

```properties
SUPABASE_URL=https://xvmgmsexzibdqptmvzdn.supabase.co
SUPABASE_ANON_KEY=eyJ...legacy-anon-key...
```

## Ejecutar web

Desde `apps/web`:

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Validacion tecnica:

```bash
npm run typecheck
npm run build
```

## Ejecutar Android

Abrir `apps/android` en Android Studio y ejecutar el modulo `app`.

Tambien se puede compilar desde terminal:

```bash
cd apps/android
gradlew.bat :app:assembleDebug
```

## Flujo QA recomendado

1. Crear usuario real en Supabase Auth.
2. Crear o verificar perfil en `users_profiles`.
3. Asignar el perfil a un proyecto en `project_users`.
4. Verificar familias asignadas en `family_assignments` cuando el rol sea tecnico.
5. Iniciar sesion en la web.
6. Revisar dashboard y CRUDs base.
7. Iniciar sesion en Android.
8. Descargar datos iniciales.
9. Desactivar internet y capturar un plan operativo.
10. Agregar actividades, linea base, meta, materiales y contrapartida.
11. Guardar borrador offline.
12. Reactivar internet y sincronizar.
13. Revisar el plan en la web.
14. Aprobar, devolver o cerrar segun corresponda.
15. Exportar PDF y Word del plan.

## No incluido en version estable 1.0

- Compras y precios reales.
- Actas de entrega PDF/Word.
- Indicadores fisicos avanzados.
- Reportes generales finales.
- Consolidado completo de materiales para compras.

## Estado

VERSION ESTABLE 1.0 LISTA PARA RESPALDO Y CONTROL DE CAMBIOS.
