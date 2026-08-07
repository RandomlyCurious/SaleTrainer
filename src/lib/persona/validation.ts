import type { ContextePersona, ResultatValidation } from "./types";

/**
 * Valide un objet inconnu contre le contrat `persona_json` (annexe A.1).
 *
 * SQUELETTE — implémentation au commit GREEN de #4.
 */
export function validerPersona(
  valeur: unknown,
  contexte: ContextePersona,
): ResultatValidation {
  void valeur;
  void contexte;
  throw new Error("NotImplemented");
}
