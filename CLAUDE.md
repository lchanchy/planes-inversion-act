# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

Sistema multi-proyecto para gestionar planes operativos de campo, consolidado de
materiales, compras, actas de entrega e indicadores físicos en proyectos de
restauración ecológica. Tres piezas sobre una base central Supabase:

- **`apps/web`** — Web administrativa (Next.js 15 + React 19 + TypeScript). Consume Supabase directamente desde el navegador con la anon key y RLS.
- **`apps/android`** — App de campo offline-first (Kotlin + Jetpack Compose + Room). Captura sin conexión y sincroniza vía PostgREST.
- **`supabase/`** — Migraciones SQL versionadas, seed y validación. PostgreSQL + Supabase Auth + Storage + Row Level Security.

El idioma de dominio es español (nombres de tablas, campos, UI). El código y las
rutas de Storage se sanitizan sin acentos (ver `sanitizeStorageName` en la ruta del acta).

## Comandos

### Web (`apps/web`)
```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:3000
npm run build      # build de producción (Next)
npm run typecheck  # tsc --noEmit (validación de tipos)
npm run lint       # next lint
```
No hay framework de tests configurado; `typecheck` + `build` son la validación técnica.

### Android (`apps/android`)
```bash
./gradlew :app:assembleDebug     # gradlew.bat en Windows
```
O abrir `apps/android` en Android Studio y ejecutar el módulo `app`. JDK 17, `compileSdk`/`targetSdk` 35, `minSdk` 26.

### Supabase
No se asume estado de migraciones gestionado por CLI. Aplicar los archivos de
`supabase/migrations/` **en orden de nombre de archivo** (timestamp) en el SQL
Editor o con la CLI, seguido de `supabase/seed.sql`. `supabase/validation_phase1.sql`
corre dentro de una transacción y termina en `rollback` (no persiste datos QA).

## Configuración (variables de entorno)

La key de Supabase debe ser la **Legacy anon key** (empieza por `eyJ`), NO la `sb_publishable_`.
El build de Android valida esto y falla si no empieza por `eyJ`.

- **Web** — `apps/web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Solo en el servidor (Vercel), para la ruta del acta: `SUPABASE_SERVICE_ROLE_KEY` (nunca en el cliente).
- **Android** — `apps/android/local.properties`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, y opcional `WEB_APP_URL`. `build.gradle.kts` los inyecta en `BuildConfig`. Si `WEB_APP_URL` está vacío, la app simplemente no pide la generación del acta firmada; todo lo demás sigue igual.

## Arquitectura

### Web: monolito de un solo componente cliente
Casi toda la web vive en **`apps/web/src/app/page.tsx`** (~12.900 líneas), un único
componente cliente. La "navegación" es estado local: la unión de tipos `ViewKey`
(dashboard, projects, profiles, families, activities, materials, counterparts, plans,
y los módulos Fase 5 `phase5_*`) controlada por `const [view, setView]`. No hay
router de páginas ni componentes por ruta — para agregar una sección se añade una
clave a `ViewKey`, un ítem de menú y su bloque de render dentro de este archivo.

- Único código de servidor: **`src/app/api/generate-act/route.ts`** (runtime `nodejs`). Usa el cliente admin con service role (omite RLS), genera el PDF del acta con `pdf-lib` (`src/lib/delivery-act/generate-act-pdf.ts`) y lo sube al bucket privado `actas`.
- Dos clientes Supabase: `src/lib/supabase.ts` (navegador, anon key) y `src/lib/supabase-admin.ts` (server-only, service role). No mezclar: el admin nunca debe importarse desde código de cliente.
- Tipos del modelo en `src/lib/types.ts`.
- Exportaciones: `exceljs` (Excel), `docx` (Word), `pdf-lib` (PDF), `jszip`.

### Android: offline-first, Room como fuente de verdad
La UI Compose entera está en **`ui/RestauracionApp.kt`** (~2.450 líneas). La lógica
de datos está en **`data/repository/RestauracionRepository.kt`**, que es donde vive
el modelo mental de sincronización:

- Cada entidad Room lleva un `SyncState { PENDING_SYNC, SYNCED, ERROR, CONFLICT }`. Room es la fuente de verdad; la red es best-effort.
- **`downloadInitialData()`** (pull): catálogos (actividades/materiales/contrapartidas) se **reemplazan** para purgar lo borrado en la web; proyectos/familias/territorio se hacen upsert; planes/entregas de otras familias se insertan solo si son nuevos (`insert*IfNew`, IGNORE en el DAO) para no pisar capturas locales. Reflejo Web→App: borra en la app filas ya SYNCED que desaparecieron del servidor, pero solo si el servidor devolvió datos (una respuesta vacía no borra).
- **`syncPending()`** (push): sube en orden de llave foránea — planes → actividades → materiales → contrapartidas → borrados de reasignación → entregas → items de entrega → y por último pide la generación del acta firmada. Los conflictos de versión de plan (constraint `operational_plans_one_active_version` / código 23505) se resuelven subiendo la versión y reintentando (hasta 5 veces).
- No usa el SDK de Supabase: habla PostgREST/Auth por REST con **Ktor** (`data/remote/SupabaseRestClient.kt`). La renovación de sesión se serializa con un `Mutex` porque Supabase rota el refresh token.
- Cableado manual de dependencias en `data/AppContainer.kt` (sin Hilt/Dagger).

### Flujo de datos entre piezas
Campo (Android, offline) captura plan/entrega → `syncPending()` → Supabase → la web
lee, revisa y **aprueba/devuelve/cierra**. El estado de aprobación vuelve a la app en
la siguiente descarga y **habilita las entregas** (no se entrega sobre un plan no
aprobado; un plan aprobado/cerrado no se edita). Tras sincronizar una entrega firmada,
la app pide a la ruta web que genere el acta PDF y la guarde en Storage.

### Modelo de datos y RLS
UUIDs en todas las llaves. Auditoría estándar (`created_at`, `updated_at`, `created_by`,
`updated_by`) y **borrado lógico** (`is_deleted`) en tablas críticas. El acceso se
controla por RLS según proyecto, rol y familias asignadas (`project_users`,
`family_assignments`). Roles: `super_admin`, `admin`, `project_admin`, `coordinator`,
`technician`, `municipal_technician`, `auditor`. RPC transaccional
`generate_family_code(project_id)` para códigos prediales consecutivos.

Las migraciones están organizadas por fases (fase 1 esquema inicial → fase 5 compras/
entregas/actas → fase 7 matriz de seguimiento, indicadores vegetales, mantenimiento,
alcance municipal de roles). Los módulos `phase5_*` de la web dependen de que sus
migraciones estén aplicadas; si faltan, la UI muestra `PHASE5_MISSING_MIGRATIONS_MESSAGE`.

## Convenciones

- **`ponytail:`** en un comentario marca una simplificación intencional. Si tiene un techo conocido (lock global, escaneo O(n²), heurística naive), el comentario nombra el techo y el camino de mejora. Ver la filosofía "lazy senior dev" en `AGENTS.md`.
- Flujo de trabajo por fases: entregar plan técnico, esperar aprobación explícita, desarrollar por fases, no construir todo al tiempo (ver `AGENTS.md` y `PLANS_RESTAURACION.md`).
- Al tocar la web, recuerda que es un solo archivo gigante: reutiliza los helpers y patrones ya presentes en `page.tsx` en vez de crear estructura nueva.
- Al tocar la sincronización de Android, un cambio en el orden de subida o en la semántica reemplazar-vs-upsert puede causar pérdida de datos de campo: entiende `downloadInitialData()`/`syncPending()` completos antes de editar.
