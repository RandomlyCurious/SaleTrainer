import { describe, expect, it } from "vitest";

import {
  NOM_SCHEMA_PERSONA,
  SCHEMA_PERSONA_JSON,
} from "@/lib/persona/schema-json";

/**
 * Le schéma est envoyé tel quel à OpenAI en mode strict (#6). Une contrainte
 * violée n'échoue pas silencieusement : l'API répond 400, et on ne le
 * découvrirait qu'en production. D'où ces tests structurels.
 *
 * Source : guide « Structured model outputs », relevé le 2026-08-07.
 */

type Noeud = Record<string, unknown>;

function objets(noeud: unknown, chemin = "racine"): Array<[string, Noeud]> {
  if (typeof noeud !== "object" || noeud === null) return [];
  const courant = noeud as Noeud;

  const trouves: Array<[string, Noeud]> =
    courant.type === "object" ? [[chemin, courant]] : [];

  for (const [cle, valeur] of Object.entries(courant)) {
    if (typeof valeur === "object" && valeur !== null) {
      trouves.push(...objets(valeur, `${chemin}.${cle}`));
    }
  }
  return trouves;
}

function clesPresentes(noeud: unknown, recherchees: string[]): string[] {
  if (typeof noeud !== "object" || noeud === null) return [];
  const trouvees: string[] = [];

  for (const [cle, valeur] of Object.entries(noeud as Noeud)) {
    if (recherchees.includes(cle)) trouvees.push(cle);
    trouvees.push(...clesPresentes(valeur, recherchees));
  }
  return trouvees;
}

describe("schema persona — contraintes du mode strict", () => {
  it("porte un nom accepte par l'API", () => {
    expect(NOM_SCHEMA_PERSONA).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it("interdit les proprietes supplementaires sur chaque objet", () => {
    const fautifs = objets(SCHEMA_PERSONA_JSON)
      .filter(([, noeud]) => noeud.additionalProperties !== false)
      .map(([chemin]) => chemin);

    expect(fautifs).toEqual([]);
  });

  it("declare toutes ses proprietes comme requises", () => {
    const fautifs = objets(SCHEMA_PERSONA_JSON)
      .filter(([, noeud]) => {
        const proprietes = Object.keys((noeud.properties ?? {}) as Noeud);
        const requises = (noeud.required ?? []) as string[];
        return proprietes.some((p) => !requises.includes(p));
      })
      .map(([chemin]) => chemin);

    expect(fautifs).toEqual([]);
  });

  it("n'utilise aucun mot-cle refuse par le mode strict", () => {
    const refuses = [
      "minItems",
      "maxItems",
      "minLength",
      "maxLength",
      "allOf",
      "not",
      "if",
      "then",
      "else",
      "dependentRequired",
      "prefixItems",
    ];

    expect(clesPresentes(SCHEMA_PERSONA_JSON, refuses)).toEqual([]);
  });
});

describe("schema persona — fidelite a l'annexe A.1", () => {
  it("declare les sept champs du contrat", () => {
    expect(SCHEMA_PERSONA_JSON.required).toEqual([
      "nom_complet",
      "role",
      "entreprise",
      "humeur",
      "objections_probables",
      "conditions_raccrochage",
      "ancrages",
    ]);
  });

  it("borne le niveau d'humeur par une enumeration", () => {
    const proprietes = (SCHEMA_PERSONA_JSON.properties as Noeud)
      .humeur as Noeud;
    const niveau = (proprietes.properties as Noeud).niveau as Noeud;

    expect(niveau.enum).toEqual([1, 2, 3]);
  });

  it("borne le libelle d'humeur par une enumeration", () => {
    const humeur = (SCHEMA_PERSONA_JSON.properties as Noeud).humeur as Noeud;
    const libelle = (humeur.properties as Noeud).libelle as Noeud;

    expect(libelle.enum).toEqual(["ouvert", "sceptique", "difficile"]);
  });

  it("borne la source des ancrages par une enumeration", () => {
    const ancrages = (SCHEMA_PERSONA_JSON.properties as Noeud).ancrages as Noeud;
    const source = ((ancrages.items as Noeud).properties as Noeud)
      .source as Noeud;

    expect(source.enum).toEqual(["linkedin", "site", "contexte", "echanges"]);
  });

  it("rend la taille d'entreprise nullable par une union de types", () => {
    const entreprise = (SCHEMA_PERSONA_JSON.properties as Noeud)
      .entreprise as Noeud;
    const taille = (entreprise.properties as Noeud).taille as Noeud;

    // Le mode strict interdit les champs optionnels : on simule le nullable
    // par une union de types.
    expect(taille.type).toEqual(["string", "null"]);
  });
});
