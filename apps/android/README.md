# App Android offline-first - Fase 4

## Alcance

Implementacion inicial de app Android nativa para captura offline de planes operativos en campo.

Incluye:

- Kotlin + Jetpack Compose.
- Room como base local.
- Login controlado contra Supabase Auth por REST.
- Descarga inicial de proyectos, familias, actividades y materiales.
- Captura local de planes, actividades, linea base, meta, materiales y contrapartida.
- Estados locales de sincronizacion: `PENDING_SYNC`, `SYNCED`, `ERROR`, `CONFLICT`.
- Sincronizacion basica hacia Supabase cuando hay conexion.

No incluye compras, actas, indicadores, reportes ni consolidado.

## Configuracion Supabase

La URL del proyecto ya queda definida en `gradle.properties`:

```properties
SUPABASE_URL=https://tu-proyecto.supabase.co
```

Para no subir la key al repositorio, crear este archivo local:

`apps/android/local.properties`

con:

```properties
SUPABASE_ANON_KEY=eyJ...legacy-anon-key...
```

Tambien se puede definir `SUPABASE_URL` ahi si se quiere sobrescribir la URL:

```properties
SUPABASE_URL=https://xvmgmsexzibdqptmvzdn.supabase.co
SUPABASE_ANON_KEY=eyJ...legacy-anon-key...
```

La key correcta es la `Legacy anon key` de Supabase, la que empieza por `eyJ`. No usar la `sb_publishable_`.

En Supabase se obtiene en `Project Settings > API`.

## Prueba

Desde `apps/android`:

```bash
gradlew.bat clean assembleDebug
```

O abrir la carpeta en Android Studio y ejecutar `app`.

## Flujo QA sugerido

1. Iniciar sesion con usuario tecnico o admin.
2. Descargar datos iniciales.
3. Activar modo avion.
4. Crear plan para una familia.
5. Agregar actividad con linea base y meta.
6. Agregar material del proyecto.
7. Agregar contrapartida familiar.
8. Confirmar que el plan queda local con `PENDING_SYNC`.
9. Reactivar conexion.
10. Sincronizar pendientes.
11. Revisar en la web que el plan llegue para revision administrativa.
