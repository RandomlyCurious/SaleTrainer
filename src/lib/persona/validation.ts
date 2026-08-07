import {
  CONDITIONS_RACCROCHAGE_MAX,
  CONDITIONS_RACCROCHAGE_MIN,
  LIBELLE_PAR_NIVEAU,
  NOMBRE_OBJECTIONS,
  SOURCES_ANCRAGE,
  type Ancrage,
  type ContextePersona,
  type ErreurValidation,
  type Persona,
  type ResultatValidation,
} from "./types";

/**
 * Valide un objet inconnu contre le contrat `persona_json` (annexe A.1).
 *
 * Toutes les erreurs sont collectées, pas seulement la première : le
 * générateur (#6) doit pouvoir décider en une passe s'il réessaie.
 *
 * Aucune valeur du persona n'est recopiée dans les messages d'erreur — ils
 * peuvent finir dans un log, et le persona porte de la PII en mode B.
 */

const CLES_ATTENDUES = [
  "nom_complet",
  "role",
  "entreprise",
  "humeur",
  "objections_probables",
  "conditions_raccrochage",
  "ancrages",
] as const;

const CLES_ENTREPRISE = ["nom", "secteur", "taille"] as const;
const CLES_HUMEUR = ["niveau", "libelle", "description"] as const;
const CLES_OBJECTION = ["intitule", "declencheur"] as const;
const CLES_ANCRAGE = ["fait", "source"] as const;

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return (
    typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
  );
}

function chaineNonVide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

function clesInconnues(
  objet: Record<string, unknown>,
  attendues: readonly string[],
  prefixe: string,
): ErreurValidation[] {
  return Object.keys(objet)
    .filter((cle) => !attendues.includes(cle))
    .map((cle) => ({
      chemin: prefixe === "" ? cle : `${prefixe}.${cle}`,
      message: "clé inconnue",
    }));
}

function validerChaine(
  valeur: unknown,
  chemin: string,
  erreurs: ErreurValidation[],
): void {
  if (!chaineNonVide(valeur)) {
    erreurs.push({ chemin, message: "chaîne non vide attendue" });
  }
}

function validerEntreprise(
  valeur: unknown,
  erreurs: ErreurValidation[],
): void {
  if (!estObjet(valeur)) {
    erreurs.push({ chemin: "entreprise", message: "objet attendu" });
    return;
  }

  erreurs.push(...clesInconnues(valeur, CLES_ENTREPRISE, "entreprise"));
  validerChaine(valeur.nom, "entreprise.nom", erreurs);
  validerChaine(valeur.secteur, "entreprise.secteur", erreurs);

  // `taille` est la seule valeur nullable du contrat.
  if (valeur.taille !== null && !chaineNonVide(valeur.taille)) {
    erreurs.push({
      chemin: "entreprise.taille",
      message: "chaîne non vide ou null attendu",
    });
  }
}

function validerHumeur(
  valeur: unknown,
  contexte: ContextePersona,
  erreurs: ErreurValidation[],
): void {
  if (!estObjet(valeur)) {
    erreurs.push({ chemin: "humeur", message: "objet attendu" });
    return;
  }

  erreurs.push(...clesInconnues(valeur, CLES_HUMEUR, "humeur"));
  validerChaine(valeur.description, "humeur.description", erreurs);

  // Le niveau recopie la difficulté demandée : un persona de niveau 3 rendu
  // pour une demande de niveau 1 n'est pas le persona qu'on a commandé.
  const niveauAttendu = contexte.difficulte;
  if (valeur.niveau !== niveauAttendu) {
    erreurs.push({
      chemin: "humeur.niveau",
      message: `niveau ${niveauAttendu} attendu (difficulté demandée)`,
    });
    return;
  }

  // Le libellé est dérivé du niveau, jamais libre.
  const libelleAttendu = LIBELLE_PAR_NIVEAU[niveauAttendu];
  if (valeur.libelle !== libelleAttendu) {
    erreurs.push({
      chemin: "humeur.libelle",
      message: `« ${libelleAttendu} » attendu pour le niveau ${niveauAttendu}`,
    });
  }
}

function validerObjections(
  valeur: unknown,
  erreurs: ErreurValidation[],
): void {
  if (!Array.isArray(valeur) || valeur.length !== NOMBRE_OBJECTIONS) {
    erreurs.push({
      chemin: "objections_probables",
      message: `exactement ${NOMBRE_OBJECTIONS} objections attendues`,
    });
    return;
  }

  valeur.forEach((objection, index) => {
    const chemin = `objections_probables[${index}]`;
    if (!estObjet(objection)) {
      erreurs.push({ chemin, message: "objet attendu" });
      return;
    }

    erreurs.push(...clesInconnues(objection, CLES_OBJECTION, chemin));
    validerChaine(objection.intitule, `${chemin}.intitule`, erreurs);
    validerChaine(objection.declencheur, `${chemin}.declencheur`, erreurs);
  });
}

function validerConditionsRaccrochage(
  valeur: unknown,
  erreurs: ErreurValidation[],
): void {
  if (
    !Array.isArray(valeur) ||
    valeur.length < CONDITIONS_RACCROCHAGE_MIN ||
    valeur.length > CONDITIONS_RACCROCHAGE_MAX
  ) {
    erreurs.push({
      chemin: "conditions_raccrochage",
      message: `entre ${CONDITIONS_RACCROCHAGE_MIN} et ${CONDITIONS_RACCROCHAGE_MAX} conditions attendues`,
    });
    return;
  }

  valeur.forEach((condition, index) => {
    validerChaine(condition, `conditions_raccrochage[${index}]`, erreurs);
  });
}

function validerAncrages(
  valeur: unknown,
  contexte: ContextePersona,
  erreurs: ErreurValidation[],
): void {
  if (!Array.isArray(valeur)) {
    erreurs.push({ chemin: "ancrages", message: "tableau attendu" });
    return;
  }

  // Mode A : aucun texte collé, donc rien à ancrer — un ancrage y serait
  // forcément inventé. Mode B : au moins un, sinon le persona n'est pas ancré
  // dans le prospect réel et le mode ne sert à rien.
  if (contexte.mode === "generique" && valeur.length > 0) {
    erreurs.push({
      chemin: "ancrages",
      message: "aucun ancrage attendu en mode générique",
    });
  }
  if (contexte.mode === "reel" && valeur.length === 0) {
    erreurs.push({
      chemin: "ancrages",
      message: "au moins un ancrage attendu en mode réel",
    });
  }

  valeur.forEach((ancrage, index) => {
    const chemin = `ancrages[${index}]`;
    if (!estObjet(ancrage)) {
      erreurs.push({ chemin, message: "objet attendu" });
      return;
    }

    erreurs.push(...clesInconnues(ancrage, CLES_ANCRAGE, chemin));
    validerChaine(ancrage.fait, `${chemin}.fait`, erreurs);

    if (!SOURCES_ANCRAGE.includes(ancrage.source as Ancrage["source"])) {
      erreurs.push({
        chemin: `${chemin}.source`,
        message: `source attendue parmi : ${SOURCES_ANCRAGE.join(", ")}`,
      });
    }
  });
}

export function validerPersona(
  valeur: unknown,
  contexte: ContextePersona,
): ResultatValidation {
  if (!estObjet(valeur)) {
    return {
      ok: false,
      erreurs: [{ chemin: "", message: "objet attendu" }],
    };
  }

  const erreurs: ErreurValidation[] = [];

  erreurs.push(...clesInconnues(valeur, CLES_ATTENDUES, ""));
  validerChaine(valeur.nom_complet, "nom_complet", erreurs);
  validerChaine(valeur.role, "role", erreurs);
  validerEntreprise(valeur.entreprise, erreurs);
  validerHumeur(valeur.humeur, contexte, erreurs);
  validerObjections(valeur.objections_probables, erreurs);
  validerConditionsRaccrochage(valeur.conditions_raccrochage, erreurs);
  validerAncrages(valeur.ancrages, contexte, erreurs);

  if (erreurs.length > 0) return { ok: false, erreurs };

  // Toutes les branches ci-dessus ont vérifié la forme ; la conversion est sûre
  // à ce point, et c'est le seul endroit du module où elle a lieu.
  return { ok: true, persona: valeur as unknown as Persona };
}
