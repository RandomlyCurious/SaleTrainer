import { genererPersona, type ErreurGeneration } from "@/lib/persona/generation";
import type { EntreesPersona } from "@/lib/persona/prompt";

/**
 * Route handler de génération du persona (#6).
 *
 * Elle existe pour une seule raison : la clé OpenAI ne doit JAMAIS atteindre
 * le navigateur. Tout l'appel LLM se fait ici, côté serveur.
 *
 * RÈGLE ABSOLUE : la réponse ne renvoie que des codes et des chemins de
 * champs — jamais un texte collé, jamais la sortie brute du modèle. Et rien
 * n'est journalisé : ces contenus portent la PII d'un tiers en mode B.
 */

const STATUT_PAR_ERREUR: Record<ErreurGeneration["type"], number> = {
  entrees_invalides: 400,
  // 502 : le modèle a répondu, mais hors contrat après rejeu. La faute est en
  // amont, pas chez l'appelant.
  sortie_invalide: 502,
  llm_indisponible: 503,
  llm_refus: 502,
};

function reponseErreur(erreur: ErreurGeneration): Response {
  const corps: Record<string, unknown> = { erreur: erreur.type };

  // Seuls les NOMS de champs remontent, jamais leurs valeurs.
  if (erreur.type === "entrees_invalides") corps.champs = erreur.champs;
  if (erreur.type === "sortie_invalide") {
    corps.champs = erreur.erreurs.map(({ chemin }) => chemin);
    corps.tentatives = erreur.tentatives;
  }

  return Response.json(corps, { status: STATUT_PAR_ERREUR[erreur.type] });
}

export async function POST(requete: Request): Promise<Response> {
  let entrees: EntreesPersona;
  try {
    entrees = (await requete.json()) as EntreesPersona;
  } catch {
    return Response.json(
      { erreur: "corps_illisible" },
      { status: 400 },
    );
  }

  const resultat = await genererPersona(entrees);

  if (!resultat.ok) return reponseErreur(resultat.erreur);

  return Response.json({ persona: resultat.persona }, { status: 200 });
}
