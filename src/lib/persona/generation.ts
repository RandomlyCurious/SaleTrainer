import type { LlmClient, LlmMessage } from "@/lib/llm/types";

import type { EntreesPersona } from "./prompt";
import type { ErreurValidation, Persona } from "./types";

/**
 * Génération du persona : texte → JSON (#6).
 *
 * SQUELETTE — implémentation au commit GREEN de #6.
 */

/** Une tentative, puis un unique rejeu. Le filet, pas le cas nominal. */
export const TENTATIVES_MAX = 2;

export type ErreurGeneration =
  | { type: "entrees_invalides"; champs: string[] }
  | { type: "sortie_invalide"; tentatives: number; erreurs: ErreurValidation[] }
  | { type: "llm_indisponible"; cause: string }
  | { type: "llm_refus" };

export type ResultatGeneration =
  | { ok: true; persona: Persona }
  | { ok: false; erreur: ErreurGeneration };

export type OptionsGeneration = {
  /** Double de test. Par défaut : le client injecté, sinon OpenAI. */
  client?: LlmClient;
};

export function construireMessagesGeneration(
  entrees: EntreesPersona,
): LlmMessage[] {
  void entrees;
  throw new Error("NotImplemented");
}

export function genererPersona(
  entrees: EntreesPersona,
  options: OptionsGeneration = {},
): Promise<ResultatGeneration> {
  void entrees;
  void options;
  throw new Error("NotImplemented");
}
