/**
 * Lecture de la configuration Supabase publique.
 *
 * Ne lève JAMAIS : le build CI tourne sans secrets, et une exception à l'import
 * ferait échouer `npm run build`. L'absence de configuration se traduit par
 * `null` ; ce sont les fabriques de clients qui décident quoi en faire, au
 * moment de l'appel.
 *
 * Les `process.env.NEXT_PUBLIC_*` sont écrits en accès statique : c'est ce que
 * Next remplace en dur au build côté navigateur. Un accès dynamique casserait
 * l'inlining.
 */

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

function valeurNonVide(brut: string | undefined): string | null {
  if (typeof brut !== "string") return null;
  const nettoye = brut.trim();
  return nettoye.length > 0 ? nettoye : null;
}

export function readPublicSupabaseEnv(): SupabasePublicEnv | null {
  const url = valeurNonVide(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = valeurNonVide(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (url === null || anonKey === null) return null;

  return { url, anonKey };
}
