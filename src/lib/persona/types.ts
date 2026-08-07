/**
 * Contrat `persona_json` — annexe A.1 de `docs/specs/simulateur-poc.md`, GELÉE.
 *
 * Le résumé à 4 champs de l'écran 1 (nom, rôle, humeur, 3 objections) est une
 * VUE de ce contrat, pas un second schéma : deux schémas concurrents pour un
 * même objet finissent toujours par diverger.
 */

export const NIVEAUX_DIFFICULTE = [1, 2, 3] as const;
export type NiveauDifficulte = (typeof NIVEAUX_DIFFICULTE)[number];

/**
 * Le libellé est DÉRIVÉ du niveau, il n'est jamais libre : sans ça, un modèle
 * peut rendre un niveau 3 étiqueté « ouvert ».
 */
export const LIBELLE_PAR_NIVEAU = {
  1: "ouvert",
  2: "sceptique",
  3: "difficile",
} as const satisfies Record<NiveauDifficulte, string>;

export type LibelleHumeur = (typeof LIBELLE_PAR_NIVEAU)[NiveauDifficulte];

export const SOURCES_ANCRAGE = [
  "linkedin",
  "site",
  "contexte",
  "echanges",
] as const;
export type SourceAncrage = (typeof SOURCES_ANCRAGE)[number];

export type ModePersona = "generique" | "reel";

export const NOMBRE_OBJECTIONS = 3;
export const CONDITIONS_RACCROCHAGE_MIN = 1;
export const CONDITIONS_RACCROCHAGE_MAX = 4;

export type Entreprise = {
  nom: string;
  secteur: string;
  taille: string | null;
};

export type Humeur = {
  niveau: NiveauDifficulte;
  libelle: LibelleHumeur;
  description: string;
};

export type Objection = {
  intitule: string;
  /** Ce qui la déclenche dans la conversation, pour qu'elle ne soit pas récitée. */
  declencheur: string;
};

export type Ancrage = {
  fait: string;
  source: SourceAncrage;
};

export type Persona = {
  nom_complet: string;
  role: string;
  entreprise: Entreprise;
  humeur: Humeur;
  objections_probables: readonly [Objection, Objection, Objection];
  conditions_raccrochage: readonly string[];
  /** Vide en mode `generique`, au moins un élément en mode `reel`. */
  ancrages: readonly Ancrage[];
};

/** Ce que la validation doit connaître en plus du JSON pour trancher. */
export type ContextePersona = {
  mode: ModePersona;
  difficulte: NiveauDifficulte;
};

export type ErreurValidation = {
  /** Chemin dans le JSON, ex. `humeur.libelle` ou `objections_probables[1]`. */
  chemin: string;
  message: string;
};

/**
 * Résultat explicite plutôt qu'une exception : un JSON de LLM invalide est un
 * cas nominal, pas un incident. L'appelant (#6) doit pouvoir réessayer.
 */
export type ResultatValidation =
  | { ok: true; persona: Persona }
  | { ok: false; erreurs: ErreurValidation[] };
