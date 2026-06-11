# Instrucciones para Codex

Proyecto: Aplicativo web + app Android offline-first para planes operativos, consolidado de materiales, compras, actas de entrega e indicadores físicos en proyectos de restauración ecológica.

## Regla obligatoria
No generar código hasta que el usuario revise y apruebe el plan técnico. Codex debe primero leer el archivo `PLANS_RESTAURACION.md`, interpretar los archivos de ejemplo ubicados en la ruta local indicada y entregar solo el plan técnico.

Solo iniciar desarrollo cuando el usuario escriba exactamente:

`APROBADO, INICIE EL DESARROLLO`

## Archivo principal de requerimientos
Leer y seguir:

`PLANS_RESTAURACION.md`

## Ruta local de ejemplos
Los formatos de referencia están en:

`C:\Users\libar\Desktop\Aplicativo planes de inversion act\Ejemplo`

Esa carpeta contiene ejemplos de plan operativo, consolidado, acta de entrega e herramienta de indicadores.

## Prioridades técnicas
- App Android nativa: Kotlin + Jetpack Compose + Room.
- Web administrativa: React + TypeScript o Next.js.
- Backend/base central: Supabase + PostgreSQL + Supabase Auth + Storage.
- Despliegue simple y económico: Vercel/Netlify + Supabase.
- Sistema multi-proyecto.
- Trabajo offline-first en Android.
- Validación de consistencia entre app y web.
- Exportaciones a Excel, CSV, PDF y Word.

## Forma de trabajo
1. Primero entregar plan técnico completo.
2. Esperar aprobación explícita.
3. Luego desarrollar por fases.
4. No construir todo al tiempo.
5. Mantener el sistema simple, mantenible y escalable.
