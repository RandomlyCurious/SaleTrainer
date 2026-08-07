/**
 * Route handler de génération du persona (#6).
 *
 * Elle existe pour une seule raison : la clé OpenAI ne doit JAMAIS atteindre
 * le navigateur. Tout l'appel LLM se fait ici, côté serveur.
 *
 * SQUELETTE — implémentation au commit GREEN de #6.
 */

export function POST(requete: Request): Promise<Response> {
  void requete;
  throw new Error("NotImplemented");
}
