/**
 * Construction du prompt système du persona (#5).
 *
 * Fonction PURE : aucune I/O, aucun appel réseau. C'est le cœur produit et le
 * morceau le plus testable de la couche vocale — la couche exemptée de TDD se
 * limite au transport WebRTC (décision du 2026-08-07).
 *
 * SQUELETTE — implémentation au commit GREEN de #5.
 */

export type TypeAppel = "cold_call" | "decouverte";
export type ModePersona = "generique" | "reel";
export type NiveauDifficulte = 1 | 2 | 3;

/** Ce que l'écran 1 collecte, avant toute génération. */
export type EntreesPersona = {
  mode: ModePersona;
  offre: string;
  cible: string;
  type_appel: TypeAppel;
  difficulte: NiveauDifficulte;
  /** Obligatoire en mode `reel`, absent en mode `generique`. */
  texte_linkedin?: string;
  texte_site?: string;
  texte_contexte?: string;
  texte_echanges?: string;
};

export type ErreurEntrees = {
  champ: string;
  message: string;
};

export type ResultatPrompt =
  | { ok: true; prompt: string }
  | { ok: false; erreurs: ErreurEntrees[] };

/** Borne de sécurité par texte collé, pour ne pas exploser la fenêtre. */
export const LONGUEUR_MAX_TEXTE_COLLE = 6000;

export function construirePromptPersona(
  entrees: EntreesPersona,
): ResultatPrompt {
  void entrees;
  throw new Error("NotImplemented");
}
