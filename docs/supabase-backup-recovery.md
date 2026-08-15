# Respaldo y recuperación de Supabase

## Alcance

Este procedimiento protege los datos del aplicativo sin modificar producción. Combina:

1. El respaldo administrado del proyecto en Supabase, que es la primera opción para recuperar la base completa.
2. Una exportación independiente de roles, esquema y datos de `public`, verificable mediante SHA-256.

Los objetos de Supabase Storage deben respaldarse por separado: la base contiene sus metadatos, pero no sustituye una copia de los archivos almacenados.

## Crear y verificar el respaldo exportable

Use una URL PostgreSQL percent-encoded entregada por Supabase y manténgala únicamente en la sesión local:

```powershell
$env:SUPABASE_DB_URL = "postgresql://..."
.\scripts\backup-supabase.ps1
Remove-Item Env:SUPABASE_DB_URL
```

También puede usar `-ProjectRef` junto con `SUPABASE_DB_PASSWORD`. El respaldo se crea, de forma predeterminada, en una carpeta hermana llamada `Aplicativo ACT respaldos`; nunca dentro de Git.

Cada respaldo contiene:

- `01-roles.sql`
- `02-public-schema.sql`
- `03-public-data.sql`
- `manifest.json`, con tamaño y SHA-256 de cada archivo

Para revisar posteriormente su integridad:

```powershell
.\scripts\verify-supabase-backup.ps1 -BackupDirectory "C:\ruta\supabase-AAAAMMDD-HHMMSS"
```

La validación exige la presencia de proyectos, usuarios, familias, predios, planes, materiales, compras, entregas y Economía Familiar.

## Frecuencia y custodia

- Antes de cada migración o carga masiva: respaldo manual verificado.
- Operación normal: respaldo semanal y conservar al menos cuatro copias.
- Cierre mensual: conservar una copia durante doce meses.
- Guardar una copia cifrada en una ubicación diferente al equipo de trabajo.
- Limitar acceso porque los archivos contienen datos personales de familias y usuarios.

## Recuperación segura

Nunca pruebe una restauración sobre producción. El orden es:

1. Crear un proyecto Supabase temporal y vacío.
2. Confirmar que no contiene información real ni integraciones activas.
3. Restaurar roles, luego esquema y finalmente datos.
4. Aplicar las migraciones posteriores a la fecha del respaldo, si existen.
5. Comparar conteos de las tablas críticas y ejecutar las validaciones funcionales.
6. Probar inicio de sesión, familias, planes, compras, entregas y encuestas con cuentas de prueba.
7. Eliminar el proyecto temporal cuando termine la validación.

La recuperación de producción solo debe realizarse después de documentar el incidente, identificar el punto de restauración y recibir aprobación explícita del responsable del proyecto.

## Lista de comprobación

- [ ] El respaldo administrado de Supabase está disponible según el plan contratado.
- [ ] La exportación independiente terminó sin errores.
- [ ] `verify-supabase-backup.ps1` confirmó hashes y tablas críticas.
- [ ] La copia está cifrada y fuera del repositorio.
- [ ] Se registró fecha, responsable y ubicación.
- [ ] La restauración se probó únicamente en un proyecto temporal.
- [ ] Los conteos y flujos funcionales coinciden antes de considerar válido el respaldo.

