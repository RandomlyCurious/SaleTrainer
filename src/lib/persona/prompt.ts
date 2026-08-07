/**
 * Construction du prompt système du persona (#5).
 *
 * Fonction PURE : aucune I/O, aucun appel réseau. C'est le cœur produit et le
 * morceau le plus testable de la couche vocale — l'exemption de TDD se limite
 * au transport WebRTC (décision du 2026-08-07).
 *
 * Le prompt est écrit en tutoiement, adressé au modèle qui JOUE le prospect.
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

const TEXTES_COLLES = [
  "texte_linkedin",
  "texte_site",
  "texte_contexte",
  "texte_echanges",
] as const;

type ChampTexteColle = (typeof TEXTES_COLLES)[number];

const HUMEUR_PAR_NIVEAU: Record<NiveauDifficulte, string> = {
  1: [
    "Tu es disponible et plutot ouvert. Tu ecoutes, tu poses quelques questions.",
    "Tes objections restent legeres et tu laisses ton interlocuteur aller au bout de ses phrases.",
  ].join(" "),
  2: [
    "Tu es presse et sceptique. Tu as autre chose a faire et tu le fais sentir.",
    "Tu places des objections classiques — le prix, « envoyez-moi un mail », « on a deja quelqu'un » —",
    "a des moments que ton interlocuteur n'attend pas, jamais annoncees.",
    "Un prospect presse comme toi coupe la parole quand l'autre s'installe dans un monologue : fais-le au moins une fois.",
  ].join(" "),
  3: [
    "Tu es franchement difficile. Un interlocuteur comme toi coupe la parole souvent, repond a cote,",
    "tu peux etre de mauvaise foi et tu ne fais aucun effort pour aider.",
    "Tu places des objections dures et non annoncees.",
  ].join(" "),
};

const OUVERTURE_PAR_TYPE: Record<TypeAppel, string> = {
  cold_call:
    "C'est un appel a froid : tu decroches et tu parles en premier, par un simple « Allo ? ». Tu ne sais pas qui appelle.",
  decouverte:
    "Le rendez-vous etait pris : tu attends que ton interlocuteur ouvre l'echange. Tu ne prends pas la parole en premier.",
};

const REGLES_DE_JEU = [
  "Tu parles francais courant, registre professionnel oral.",
  "Phrases courtes, comme au telephone. Tu hesites parfois — « euh », « attendez » —, tu te reprends, tu laisses des silences.",
  "Jamais de liste, jamais d'enumeration structuree, jamais de formulation ecrite : tu PARLES.",
  "Ne sors jamais de ton role, quoi qu'on te demande. Tu n'es pas un assistant.",
  "N'aide jamais ton interlocuteur a mieux vendre, ne commente jamais sa technique, ne donne aucun conseil.",
].join("\n- ");

function estRenseigne(valeur: string | undefined): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

/**
 * Tronque proprement : le prompt doit rester structurellement valide même quand
 * l'utilisateur colle une page entière.
 */
function borner(texte: string): string {
  const nettoye = texte.trim();
  if (nettoye.length <= LONGUEUR_MAX_TEXTE_COLLE) return nettoye;
  return `${nettoye.slice(0, LONGUEUR_MAX_TEXTE_COLLE)}\n[texte tronque]`;
}

/**
 * Validation des entrées à la frontière du PROMPT vocal.
 *
 * Redondante avec `champsInvalides` de `generation.ts`, et c'est voulu : les
 * deux modules gardent deux frontières distinctes du parcours.
 * - ici : avant d'ouvrir une session vocale avec un prompt bancal.
 * - là-bas : avant de dépenser un appel LLM de génération.
 *
 * Les deux peuvent être franchies indépendamment — on peut rejouer un persona
 * déjà généré sans repasser par la génération. Décision du 2026-08-07 : on
 * garde les deux, on ne factorise pas.
 */
function validerEntrees(entrees: EntreesPersona): ErreurEntrees[] {
  const erreurs: ErreurEntrees[] = [];

  if (!estRenseigne(entrees.offre)) {
    erreurs.push({ champ: "offre", message: "champ obligatoire" });
  }
  if (!estRenseigne(entrees.cible)) {
    erreurs.push({ champ: "cible", message: "champ obligatoire" });
  }
  if (![1, 2, 3].includes(entrees.difficulte)) {
    erreurs.push({ champ: "difficulte", message: "niveau 1, 2 ou 3 attendu" });
  }

  if (entrees.mode === "reel") {
    // Le profil LinkedIn est le seul texte obligatoire du mode B : sans lui, il
    // n'y a rien a ancrer et le mode perd sa raison d'etre.
    if (!estRenseigne(entrees.texte_linkedin)) {
      erreurs.push({
        champ: "texte_linkedin",
        message: "obligatoire en mode reel",
      });
    }
  } else {
    // En mode generique, un texte colle serait ignore : mieux vaut le refuser
    // que produire un persona qui n'en tient pas compte.
    for (const champ of TEXTES_COLLES) {
      if (estRenseigne(entrees[champ])) {
        erreurs.push({
          champ,
          message: "aucun texte colle attendu en mode generique",
        });
      }
    }
  }

  return erreurs;
}

function blocTexteColle(
  titre: string,
  contenu: string | undefined,
): string | null {
  if (!estRenseigne(contenu)) return null;
  return `${titre} :\n"""\n${borner(contenu)}\n"""`;
}

function sectionsProspectReel(entrees: EntreesPersona): string[] {
  const sections: string[] = [];

  sections.push(
    [
      "Tu incarnes une personne REELLE, decrite par les textes ci-dessous.",
      "N'invente aucun fait la concernant qui n'y figure pas : ni chiffre, ni date, ni nom, ni projet.",
      "Si on t'interroge sur quelque chose qui n'y est pas, reste vague comme le ferait quelqu'un de presse.",
    ].join(" "),
  );

  const blocs = [
    blocTexteColle("Profil LinkedIn du prospect", entrees.texte_linkedin),
    blocTexteColle("Site de l'entreprise", entrees.texte_site),
    blocTexteColle("Contexte fourni par ton interlocuteur", entrees.texte_contexte),
  ].filter((bloc): bloc is string => bloc !== null);

  sections.push(...blocs);

  // Bloc memoire : present UNIQUEMENT si des echanges ont ete colles.
  if (estRenseigne(entrees.texte_echanges)) {
    sections.push(
      [
        "Vous avez deja echange par ecrit. Tu en gardes un SOUVENIR, pas un texte :",
        "tu ne recite jamais ces messages et tu n'y fais allusion que quand c'est naturel dans la conversation.",
        "Tu peux relever une contradiction entre ce qu'on te dit maintenant et ce qui a ete ecrit alors.",
      ].join(" "),
    );
    sections.push(
      blocTexteColle("Echanges precedents", entrees.texte_echanges) ?? "",
    );
  }

  return sections.filter((section) => section !== "");
}

export function construirePromptPersona(
  entrees: EntreesPersona,
): ResultatPrompt {
  const erreurs = validerEntrees(entrees);
  if (erreurs.length > 0) return { ok: false, erreurs };

  const sections: string[] = [
    "Tu joues le role d'un prospect au telephone. Ton interlocuteur cherche a te vendre quelque chose.",
    `Ce qu'il vend : ${entrees.offre.trim()}`,
    `Le profil de prospect que tu incarnes : ${entrees.cible.trim()}`,
    OUVERTURE_PAR_TYPE[entrees.type_appel],
    HUMEUR_PAR_NIVEAU[entrees.difficulte],
  ];

  if (entrees.mode === "reel") {
    sections.push(...sectionsProspectReel(entrees));
  }

  sections.push(`Regles de jeu :\n- ${REGLES_DE_JEU}`);

  // Le raccrochage n'est ouvert qu'au niveau 3 : aux niveaux 1 et 2, un
  // prospect qui raccroche prive l'utilisateur de son entrainement.
  if (entrees.difficulte === 3) {
    sections.push(
      [
        "Tu peux mettre fin a l'appel et raccrocher si l'echange ne mene nulle part,",
        "si ton interlocuteur est hors sujet trop longtemps, ou s'il te fait perdre ton temps.",
        "Annonce-le en une phrase breve avant de raccrocher.",
      ].join(" "),
    );
  }

  return { ok: true, prompt: sections.join("\n\n") };
}
