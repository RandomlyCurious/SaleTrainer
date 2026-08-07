/**
 * Contrat d'accès au LLM texte (génération de persona, debrief).
 *
 * L'app ne parle JAMAIS à OpenAI directement : elle passe par cette interface.
 * C'est ce qui permet à la CI de tourner sans clé API — les tests injectent un
 * double via `setLlmClient`.
 */

export type LlmMessage = {
  role: "system" | "user";
  content: string;
};

/**
 * Schéma JSON strict pour les sorties structurées (#6).
 *
 * Contraintes du mode strict, vérifiées par `tests/persona/schema-json.test.ts` :
 * `additionalProperties: false` sur tout objet, toutes les propriétés dans
 * `required`, et AUCUN mot-clé non supporté (`minItems`, `maxItems`,
 * `minLength`…). Conséquence directe : le schéma garantit la FORME, jamais les
 * règles de cardinalité du contrat — « exactement 3 objections » reste à la
 * charge du validateur (#4).
 */
export type LlmJsonSchema = {
  /** Nom du schéma transmis à l'API, `[a-zA-Z0-9_-]`. */
  nom: string;
  schema: Record<string, unknown>;
};

export type LlmCompletionInput = {
  messages: LlmMessage[];
  /** Borne de sortie, pour éviter une réponse qui part en vrille. */
  maxOutputTokens?: number;
  /** Quand il est fourni, la sortie est contrainte par le schéma, en mode strict. */
  jsonSchema?: LlmJsonSchema;
};

export interface LlmClient {
  /** Renvoie le texte brut produit par le modèle. Le parsing est à l'appelant. */
  complete(input: LlmCompletionInput): Promise<string>;
}

/** Le modèle a refusé de répondre — cas nominal, pas une panne. */
export class LlmRefusError extends Error {
  constructor(message = "Le modèle a refusé de répondre.") {
    super(message);
    this.name = "LlmRefusError";
  }
}

/** Appel impossible ou réponse inexploitable : réseau, HTTP, troncature. */
export class LlmIndisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmIndisponibleError";
  }
}
