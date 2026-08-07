import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readPublicSupabaseEnv } from "./env";
import { SupabaseNotConfiguredError } from "./errors";

/**
 * Client Supabase côté serveur, adossé aux cookies de la requête.
 *
 * C'est lui qui porte la session : sans elle `auth.uid()` est nul et les
 * policies RLS (#2) refusent tout. Construit à l'appel, jamais à l'import.
 */
export async function createServerSupabaseClient() {
  const env = readPublicSupabaseEnv();
  if (env === null) throw new SupabaseNotConfiguredError();

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesAPoser) {
        try {
          for (const { name, value, options } of cookiesAPoser) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appel depuis un Server Component : l'écriture de cookies y est
          // interdite. Le rafraîchissement de session se fait ailleurs (#3).
        }
      },
    },
  });
}
