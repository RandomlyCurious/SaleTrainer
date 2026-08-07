import type { LlmClient } from "./types";

/**
 * Implémentation `LlmClient` adossée à l'API Responses d'OpenAI (#6).
 *
 * `fetch` direct, pas de SDK : un seul appel, aucune dépendance à justifier.
 *
 * SQUELETTE — implémentation au commit GREEN de #6.
 */

export type OptionsClientOpenAI = {
  /** Injectable pour les tests : aucun appel réseau réel n'est jamais fait. */
  fetchImpl?: typeof fetch;
};

export function creerClientOpenAI(options: OptionsClientOpenAI = {}): LlmClient {
  void options;
  throw new Error("NotImplemented");
}

/**
 * Le client injecté s'il y en a un, sinon un client OpenAI.
 *
 * Construit à l'appel : aucun effet de bord à l'import, et un double injecté
 * par un test gagne toujours.
 */
export function clientLlmParDefaut(): LlmClient {
  throw new Error("NotImplemented");
}
