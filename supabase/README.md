# Fase 1 - Supabase/PostgreSQL

## Objetivo

Crear la base tecnica inicial del sistema multi-proyecto: esquema relacional, roles, asignaciones, auditoria, estados controlados, RPC para codigos prediales consecutivos, seeds minimos y borrador funcional de Row Level Security.

## Archivos

- `supabase/migrations/20260610220000_initial_schema.sql`
- `supabase/seed.sql`
- `supabase/README.md`

## Como probar

1. Crear o abrir un proyecto Supabase local/remoto.
2. Aplicar la migracion:

```bash
supabase db reset
```

o, si se aplica manualmente, ejecutar primero la migracion SQL y luego `seed.sql`.

Si no existe Supabase CLI local, abrir el SQL Editor de Supabase remoto y ejecutar, en este orden:

1. `supabase/migrations/20260610220000_initial_schema.sql`
2. `supabase/seed.sql`
3. `supabase/validation_phase1.sql`

El script de validacion corre dentro de una transaccion y termina con `rollback`, por lo que no deja usuarios ni registros QA persistidos.

3. Verificar tablas principales:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

4. Verificar roles:

```sql
select name, permissions
from public.roles
order by name;
```

5. Probar RPC transaccional de codigo predial:

```sql
select public.generate_family_code('00000000-0000-0000-0000-000000000101');
select public.generate_family_code('00000000-0000-0000-0000-000000000101');
```

Resultado esperado: `RE-0001`, luego `RE-0002`.

6. Verificar que el consecutivo avanzo:

```sql
select code_prefix, next_family_number
from public.projects
where id = '00000000-0000-0000-0000-000000000101';
```

Resultado esperado: `next_family_number = 3` despues de dos llamadas.

7. Verificar que las entregas parciales estan modeladas:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'purchase_family_allocations'
order by ordinal_position;
```

Debe existir `allocated_quantity`, `delivered_quantity` y `pending_quantity`.

## Que quedo implementado

- Tablas principales del modelo aprobado.
- Llaves primarias UUID.
- Llaves foraneas principales.
- Indices operativos iniciales.
- Restricciones unicas para proyectos, familias, compras, asignaciones y catalogos.
- Estados controlados mediante tipos enum y checks.
- Campos de auditoria estandar.
- Triggers basicos para `created_at`, `updated_at`, `created_by`, `updated_by`.
- Tablas `project_users` y `family_assignments`.
- RPC `generate_family_code(project_id)` con bloqueo transaccional.
- Compras y entregas parciales mediante cantidades asignadas, entregadas y pendientes.
- Trigger de consistencia para recalcular entregas parciales e impedir entregar mas de lo asignado.
- Borrador funcional de RLS por proyecto, rol y familia asignada.
- Grants base para rol `authenticated`; RLS sigue siendo quien limita el acceso.
- Seeds minimos para roles, proyecto demo, municipio/vereda, actividades, materiales y plantilla base.

## Validacion ejecutable

Archivo:

- `supabase/validation_phase1.sql`

Casos cubiertos:

- Migracion y seed aplicados desde cero.
- Existencia de tablas, tipos, indices, funciones, trigger y politicas RLS.
- RPC `generate_family_code(project_id)` con consecutivos `RE-0001` y `RE-0002`.
- Bloqueo de `family_code` duplicado dentro del mismo proyecto.
- Bloqueo de entrega parcial mayor a la cantidad asignada.
- RLS basico:
  - Admin gestiona datos del proyecto asignado.
  - Tecnico solo ve familia asignada.
  - Tecnico no edita planes aprobados.
  - Visor no escribe.

## Checklist de aprobacion Fase 1

- [ ] Migracion ejecutada sin errores.
- [ ] Seed ejecutado sin errores.
- [ ] Script `validation_phase1.sql` ejecutado sin errores.
- [ ] RPC `generate_family_code(project_id)` validada.
- [ ] Restriccion de duplicado de `family_code` validada.
- [ ] Trigger de entregas parciales validado.
- [ ] RLS Admin validado.
- [ ] RLS Tecnico validado.
- [ ] RLS Visor validado.
- [ ] Grants revisados.

## Pendientes tecnicos

### Critico

- Ninguno identificado en esta fase.

### Importante

- Validar las politicas RLS con usuarios reales de Supabase Auth y perfiles asociados.
- Agregar funciones administrativas para crear familia y codigo en una sola transaccion si QA lo solicita.
- Completar pruebas automatizadas de migraciones en CI cuando exista repositorio web/backend.
- Agregar validacion final de "acta generada" solo cuando exista al menos un item; el modelo ya soporta los items, pero la regla fina se cerrara con el flujo web de actas.

### Menor

- Ajustar nombres exactos de actividades/materiales semilla contra catalogos institucionales definitivos.
- Refinar permisos JSON por rol cuando se implementen pantallas web.
- Agregar comentarios extendidos de columnas si se requiere documentacion de base de datos generada.

## Resultado esperado

La base queda lista para revision QA de Fase 1. No incluye app Android, web administrativa, dashboards, actas finales, indicadores avanzados ni reportes finales.
