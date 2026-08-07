import { clientLlmParDefaut } from "@/lib/llm/openai";
import {
  LlmRefusError,
  type LlmClient,
  type LlmMessage,
} from "@/lib/llm/types";

import { LONGUEUR_MAX_TEXTE_COLLE, type EntreesPersona } from "./prompt";
import { NOM_SCHEMA_PERSONA, SCHEMA_PERSONA_JSON } from "./schema-json";
import type { ErreurValidation, Persona } from "./types";
import { validerPersona } from "./validation";

/**
 * Génération du persona : texte → JSON (#6).
 *
 * Les sorties structurées strictes garantissent la FORME du JSON. Elles ne
 * garantissent aucune cardinalité — `minItems` n'est pas supporté en mode
 * strict — donc `validerPersona` (#4) reste le contrat, et le rejeu reste le
 * filet. Le filet, pas le cas nominal.
 *
 * RÈGLE ABSOLUE : aucun payload, aucun texte collé, aucune sortie de modèle
 * n'est journalisé. Ces contenus portent la PII d'un tiers en mode B.
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

const TEXTES_COLLES = [
  ["texte_linkedin", "Profil LinkedIn du prospect"],
  ["texte_site", "Site de l'entreprise"],
  ["texte_contexte", "Contexte fourni par le commercial"],
  ["texte_echanges", "Echanges precedents"],
] as const;

function estRenseigne(valeur: string | undefined): valeur is string {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

function borner(texte: string): string {
  const nettoye = texte.trim();
  if (nettoye.length <= LONGUEUR_MAX_TEXTE_COLLE) return nettoye;
  return `${nettoye.slice(0, LONGUEUR_MAX_TEXTE_COLLE)}\n[texte tronque]`;
}

/**
 * Validation des entrées, alignée sur celle de #5.
 *
 * Volontairement redondante avec `construirePromptPersona` : les deux modules
 * sont appelés à des moments différents du parcours, et laisser passer un mode
 * B sans profil collé produirait un persona inventé de bout en bout.
 */
function champsInvalides(entrees: EntreesPersona): string[] {
  const champs: string[] = [];

  if (!estRenseigne(entrees.offre)) champs.push("offre");
  if (!estRenseigne(entrees.cible)) champs.push("cible");
  if (![1, 2, 3].includes(entrees.difficulte)) champs.push("difficulte");
  if (entrees.mode === "reel" && !estRenseigne(entrees.texte_linkedin)) {
    champs.push("texte_linkedin");
  }

  return champs;
}

export function construireMessagesGeneration(
  entrees: EntreesPersona,
): LlmMessage[] {
  const consigne = [
    "Tu construis la fiche d'un prospect B2B pour un simulateur d'appel.",
    "Tu reponds UNIQUEMENT par le JSON demande, sans commentaire.",
    "Les objections doivent etre plausibles pour ce prospect precis, pas generiques.",
    "Le niveau d'humeur recopie exactement la difficulte demandee.",
  ].join(" ");

  const sections: string[] = [
    `Offre a vendre : ${entrees.offre.trim()}`,
    `Profil de prospect vise : ${entrees.cible.trim()}`,
    `Type d'appel : ${entrees.type_appel}`,
    `Difficulte demandee (a recopier dans humeur.niveau) : ${entrees.difficulte}`,
  ];

  if (entrees.mode === "reel") {
    sections.push(
      [
        "Ce prospect est REEL. Construis sa fiche a partir des seuls textes ci-dessous.",
        "N'invente aucun fait le concernant. Chaque element de `ancrages` doit provenir",
        "d'un de ces textes, et `source` doit dire duquel.",
      ].join(" "),
    );

    for (const [champ, titre] of TEXTES_COLLES) {
      const contenu = entrees[champ];
      if (estRenseigne(contenu)) {
        sections.push(`${titre} :\n"""\n${borner(contenu)}\n"""`);
      }
    }
  } else {
    // Mode generique : aucun texte colle, donc aucun ancrage possible.
    sections.push(
      "Ce prospect est fictif : invente une identite plausible et laisse `ancrages` vide.",
    );
  }

  return [
    { role: "system", content: consigne },
    { role: "user", content: sections.join("\n\n") },
  ];
}

export async function genererPersona(
  entrees: EntreesPersona,
  options: OptionsGeneration = {},
): Promise<ResultatGeneration> {
  const champs = champsInvalides(entrees);
  if (champs.length > 0) {
    return { ok: false, erreur: { type: "entrees_invalides", champs } };
  }

  const client = options.client ?? clientLlmParDefaut();
  const messages = construireMessagesGeneration(entrees);
  const contexte = { mode: entrees.mode, difficulte: entrees.difficulte };

  let dernieresErreurs: ErreurValidation[] = [];

  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative += 1) {
    let brut: string;
    try {
      brut = await client.complete({
        messages,
        jsonSchema: { nom: NOM_SCHEMA_PERSONA, schema: SCHEMA_PERSONA_JSON },
      });
    } catch (erreur) {
      // Un refus ne se rejoue pas : le modèle a tranché, insister coûte un
      // appel pour le même résultat.
      if (erreur instanceof LlmRefusError) {
        return { ok: false, erreur: { type: "llm_refus" } };
      }
      return {
        ok: false,
        erreur: {
          type: "llm_indisponible",
          cause: erreur instanceof Error ? erreur.message : "cause inconnue",
        },
      };
    }

    let analyse: unknown;
    try {
      analyse = JSON.parse(brut);
    } catch {
      dernieresErreurs = [{ chemin: "", message: "JSON malformé" }];
      continue;
    }

    const validation = validerPersona(analyse, contexte);
    if (validation.ok) return { ok: true, persona: validation.persona };

    dernieresErreurs = validation.erreurs;
  }

  return {
    ok: false,
    erreur: {
      type: "sortie_invalide",
      tentatives: TENTATIVES_MAX,
      erreurs: dernieresErreurs,
    },
  };
}
