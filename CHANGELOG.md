# Changelog

## Version estable 1.0 - 2026-06-10

### Supabase/PostgreSQL

- Se implemento el esquema base multi-proyecto.
- Se agregaron roles, perfiles, usuarios por proyecto y asignaciones de familias.
- Se implementaron estados controlados, auditoria, indices, llaves foraneas y restricciones unicas.
- Se agrego RPC transaccional `generate_family_code(project_id)`.
- Se valido la base con `validation_phase1.sql`.
- Se agrego modelo territorial normalizado para departamentos, municipios, veredas y relaciones con proyectos.
- Se agrego catalogo de contrapartidas familiares `counterpart_catalog`.

### Web administrativa

- Se implemento Next.js/React + TypeScript.
- Se agrego login con Supabase Auth.
- Se implemento dashboard basico.
- Se agregaron CRUDs de proyectos, usuarios/perfiles, familias, actividades, materiales y contrapartidas.
- Se agrego carga CSV/Excel basica de familias y catalogos.
- Se agrego selector territorial en cascada para proyectos.
- Se filtro municipio/vereda de familias segun proyecto.

### Planes operativos web

- Se implemento menu de Planes Operativos.
- Se agregaron filtros por proyecto, familia, municipio, vereda y estado.
- Se implemento detalle de plan con actividades, materiales y contrapartida.
- Se agregaron acciones de revision: enviar a revision, aprobar, devolver y cerrar.
- Se agregaron validaciones de aprobacion y resolucion de materiales provisionales.

### Android offline-first

- Se implemento app Android con Kotlin, Jetpack Compose y Room.
- Se agrego login contra Supabase Auth.
- Se agrego descarga inicial de proyectos, familias y catalogos.
- Se implemento captura offline de planes operativos.
- Se agregaron actividades con linea base y meta.
- Se agregaron materiales del proyecto y contrapartida familiar.
- Se agregaron estados de sincronizacion local.
- Se corrigieron errores de Gradle/JVM, Supabase config, serializacion y Room.
- Se mejoro UX/UI, logo, nombre visible y flujo de captura.
- Se valido apertura, captura, guardado offline y sincronizacion.

### Exportacion de planes operativos

- Se implemento exportacion individual de planes a PDF imprimible y Word compatible.
- Se implemento exportacion masiva de planes visibles segun filtros.
- Se agrego formato con encabezado de proyecto/familia/territorio/estado.
- Se agruparon actividades con aporte de familia y aporte del proyecto.
- Se agregaron subtotales y total general.

### Pendientes fuera de version 1.0

- Compras.
- Actas de entrega.
- Indicadores avanzados.
- Reportes generales.
- Consolidado final para compras.

