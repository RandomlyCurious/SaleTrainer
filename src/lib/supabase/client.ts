import { createBrowserClient } from "@supabase/ssr";

import { readPublicSupabaseEnv } from "./env";
import { SupabaseNotConfiguredError } from "./errors";

/**
 * Client Supabase côté navigateur (clé anon uniquement).
 *
 * Construit à l'appel, jamais à l'import : un client instancié au chargement du
 * module ferait échouer le build quand les variables ne sont pas là.
 *
 * La `service_role` n'a rien à faire ici — interdit absolu du projet. Toutes les
 * lectures/écritures passent par les policies RLS (#2).
 */
export function createBrowserSupabaseClient() {
  const env = readPublicSupabaseEnv();
  if (env === null) throw new SupabaseNotConfiguredError();

  return createBrowserClient(env.url, env.anonKey);
}
