# Web administrativa - Fase 2

## Alcance

Base Next.js/React + TypeScript conectada a Supabase para administracion inicial:

- Login con Supabase Auth.
- Layout con menu lateral.
- Dashboard basico.
- CRUD base de proyectos.
- CRUD base de usuarios/perfiles.
- CRUD base de familias.
- CRUD base de catalogo de actividades.
- CRUD base de catalogo de materiales.
- Control inicial de permisos por rol visible.
- Estados de carga y errores.

No incluye planes operativos completos, compras, actas, indicadores, reportes ni app Android.

## Configuracion

1. Copiar `.env.example` a `.env.local`.
2. Completar:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

3. Instalar dependencias y ejecutar:

```bash
npm install
npm run dev
```

4. Abrir `http://localhost:3000`.

## Requisitos de datos

- Fase 1 debe estar aplicada y validada.
- Debe existir al menos un usuario en Supabase Auth.
- Ese usuario debe tener registro en `users_profiles`.
- Para editar, el perfil debe tener rol `admin` o `coordinator` segun RLS.
