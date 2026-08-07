import type { LlmClient } from "./types";

/**
 * Point d'injection du `LlmClient`.
 *
 * Aucune clé API n'est lue ici, et aucun client n'est construit à l'import :
 * importer ce module dans un environnement sans secret (CI, build) doit rester
 * inoffensif. Le client concret est enregistré au démarrage de l'app ou
 * remplacé par un double dans les tests.
 */

export class LlmNotConfiguredError extends Error {
  constructor(
    message = "Aucun LlmClient enregistré : appelle setLlmClient() avant d'utiliser le LLM.",
  ) {
    super(message);
    this.name = "LlmNotConfiguredError";
  }
}

let client: LlmClient | null = null;

export function setLlmClient(nouveau: LlmClient): void {
  client = nouveau;
}

export function resetLlmClient(): void {
  client = null;
}

export function resolveLlmClient(): LlmClient {
  if (client === null) throw new LlmNotConfiguredError();
  return client;
}

/**
 * Le client injecté, ou `null` — sans lever.
 *
 * Sert aux appelants qui savent se rabattre sur une implémentation par défaut
 * (#6). Utiliser `resolveLlmClient()` et rattraper son exception marcherait,
 * mais ferait du contrôle de flux avec une erreur : ici l'absence est un cas
 * nominal, pas un incident.
 */
export function peekLlmClient(): LlmClient | null {
  return client;
}
