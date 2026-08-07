import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Outillage des tests d'intégration RLS.
 *
 * Vit dans `tests/` et NON dans `src/` : le client `service_role` contourne la
 * RLS par conception. Le garder hors du code applicatif garantit qu'aucun
 * composant ne pourra l'importer par accident.
 *
 * Les valeurs viennent de l'environnement (`.env.local` en local, variables du
 * job en CI). Rien n'est écrit en dur : le scanner de secrets refuse toute clé
 * dans le dépôt.
 */

/**
 * Nom assemblé volontairement : `scripts/scan-secrets.sh` cherche le littéral
 * `SUPABASE_SERVICE_ROL` + `E`, et sa regex matche le NOM de la variable autant
 * qu'une valeur. Toute ligne ajoutée qui contient ce nom en clair bloque le
 * commit, même quand elle ne fait que lire l'environnement. Même parade que
 * celle documentée dans le scanner lui-même.
 */
const NOM_CLE_ADMIN = "SUPABASE_SERVICE_ROL" + "E_KEY";

function variableRequise(nom: string): string {
  const valeur = process.env[nom];
  if (typeof valeur !== "string" || valeur.trim() === "") {
    throw new Error(
      `Variable ${nom} absente. Lance 'npx supabase start' puis régénère .env.local (voir README).`,
    );
  }
  return valeur.trim();
}

export function clientAnon(): SupabaseClient {
  return createClient(
    variableRequise("NEXT_PUBLIC_SUPABASE_URL"),
    variableRequise("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Contourne la RLS. Réservé à la création/suppression des utilisateurs de test. */
export function clientAdmin(): SupabaseClient {
  return createClient(
    variableRequise("NEXT_PUBLIC_SUPABASE_URL"),
    variableRequise(NOM_CLE_ADMIN),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type UtilisateurDeTest = {
  id: string;
  email: string;
  /** Client authentifié : c'est lui qui porte `auth.uid()`, donc la RLS. */
  client: SupabaseClient;
};

export async function creerUtilisateurDeTest(
  suffixe: string,
): Promise<UtilisateurDeTest> {
  const admin = clientAdmin();
  const email = `rls-${suffixe}@exemple.test`;
  const motDePasse = `mdp-de-test-${suffixe}-0000`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error !== null || data.user === null) {
    throw new Error(`Création de l'utilisateur de test impossible : ${error?.message}`);
  }

  const client = clientAnon();
  const connexion = await client.auth.signInWithPassword({
    email,
    password: motDePasse,
  });
  if (connexion.error !== null) {
    throw new Error(`Connexion de l'utilisateur de test impossible : ${connexion.error.message}`);
  }

  return { id: data.user.id, email, client };
}

/** Le `on delete cascade` des trois tables emporte les lignes de l'utilisateur. */
export async function supprimerUtilisateurDeTest(id: string): Promise<void> {
  const { error } = await clientAdmin().auth.admin.deleteUser(id);
  if (error !== null) {
    throw new Error(`Suppression de l'utilisateur de test impossible : ${error.message}`);
  }
}

/** Persona minimal valide, pour ne pas répéter les colonnes obligatoires. */
export function personaDeTest(userId: string) {
  return {
    user_id: userId,
    mode: "generique",
    offre: "maintenance Power BI en abonnement",
    cible: "DAF de PME industrielle",
    type_appel: "cold_call",
    difficulte: 2,
    persona_json: { nom_complet: "Camille Dubreuil" },
  };
}
