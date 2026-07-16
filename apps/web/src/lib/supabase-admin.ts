import { createClient } from "@supabase/supabase-js";

// Cliente Supabase server-only con service role (omite RLS). SOLO para rutas de servidor.
// La service role key vive en la variable de entorno SUPABASE_SERVICE_ROLE_KEY (Vercel), nunca en el cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
