/**
 * Contrat d'accès au LLM texte (génération de persona, debrief).
 *
 * L'app ne parle JAMAIS à OpenAI directement : elle passe par cette interface.
 * C'est ce qui permet à la CI de tourner sans clé API — les tests injectent un
 * double via `setLlmClient`. L'implémentation réelle arrive au ticket #6.
 */

export type LlmMessage = {
  role: "system" | "user";
  content: string;
};

export type LlmCompletionInput = {
  messages: LlmMessage[];
  /** Borne de sortie, pour éviter une réponse qui part en vrille. */
  maxOutputTokens?: number;
};

export interface LlmClient {
  /** Renvoie le texte brut produit par le modèle. Le parsing est à l'appelant. */
  complete(input: LlmCompletionInput): Promise<string>;
}
