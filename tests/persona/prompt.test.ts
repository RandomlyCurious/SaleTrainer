import { describe, expect, it } from "vitest";

import {
  construirePromptPersona,
  LONGUEUR_MAX_TEXTE_COLLE,
  type EntreesPersona,
} from "@/lib/persona/prompt";

/**
 * Prompt système du persona (#5) — fonction pure.
 *
 * Les tests portent sur ce que le prompt CONTIENT ou NE CONTIENT PAS, pas sur
 * sa formulation exacte : la rédaction bougera, le contrat non.
 */

function entreesModeA(
  surcharge: Partial<EntreesPersona> = {},
): EntreesPersona {
  return {
    mode: "generique",
    offre: "maintenance Power BI en abonnement pour PME",
    cible: "DAF de PME industrielle de 50 a 200 personnes",
    type_appel: "cold_call",
    difficulte: 2,
    ...surcharge,
  };
}

function entreesModeB(
  surcharge: Partial<EntreesPersona> = {},
): EntreesPersona {
  return {
    ...entreesModeA(),
    mode: "reel",
    texte_linkedin: "Camille Dubreuil — DAF chez Fonderie Vallet depuis 2021.",
    ...surcharge,
  };
}

function promptDe(entrees: EntreesPersona): string {
  const resultat = construirePromptPersona(entrees);
  if (!resultat.ok) {
    throw new Error(
      `prompt attendu, erreurs : ${resultat.erreurs.map((e) => e.champ).join(", ")}`,
    );
  }
  return resultat.prompt;
}

function champsEnErreur(entrees: EntreesPersona): string[] {
  const resultat = construirePromptPersona(entrees);
  return resultat.ok ? [] : resultat.erreurs.map((erreur) => erreur.champ);
}

describe("mode A — persona generique", () => {
  it("reprend l'offre et la cible", () => {
    const prompt = promptDe(entreesModeA());

    expect(prompt).toContain("maintenance Power BI en abonnement pour PME");
    expect(prompt).toContain("DAF de PME industrielle de 50 a 200 personnes");
  });

  it("ne contient aucun bloc de prospect reel", () => {
    const prompt = promptDe(entreesModeA()).toLowerCase();

    expect(prompt).not.toContain("linkedin");
    expect(prompt).not.toContain("echanges precedents");
  });

  it("produit un bloc d'humeur distinct par niveau", () => {
    const prompts = [1, 2, 3].map((difficulte) =>
      promptDe(entreesModeA({ difficulte: difficulte as 1 | 2 | 3 })),
    );

    expect(new Set(prompts).size).toBe(3);
  });

  it("n'annonce les interruptions qu'a partir du niveau 2", () => {
    const niveau1 = promptDe(entreesModeA({ difficulte: 1 })).toLowerCase();
    const niveau2 = promptDe(entreesModeA({ difficulte: 2 })).toLowerCase();
    const niveau3 = promptDe(entreesModeA({ difficulte: 3 })).toLowerCase();

    expect(niveau1).not.toContain("coupe la parole");
    expect(niveau2).toContain("coupe la parole");
    expect(niveau3).toContain("coupe la parole");
  });

  it("n'autorise le raccrochage qu'au niveau 3", () => {
    expect(promptDe(entreesModeA({ difficulte: 1 }))).not.toContain("raccroch");
    expect(promptDe(entreesModeA({ difficulte: 3 }))).toContain("raccroch");
  });
});

describe("regles de comportement", () => {
  it("impose l'oral et interdit les listes", () => {
    const prompt = promptDe(entreesModeA()).toLowerCase();

    expect(prompt).toContain("jamais de liste");
    expect(prompt).toContain("phrases courtes");
  });

  it("interdit de sortir du role et d'aider l'utilisateur", () => {
    const prompt = promptDe(entreesModeA()).toLowerCase();

    expect(prompt).toContain("ne sors jamais de ton role");
    expect(prompt).toContain("n'aide jamais");
  });
});

describe("ouverture selon le type d'appel", () => {
  it("fait parler le prospect en premier en cold call", () => {
    const prompt = promptDe(
      entreesModeA({ type_appel: "cold_call" }),
    ).toLowerCase();

    expect(prompt).toContain("tu decroches et tu parles en premier");
  });

  it("fait attendre le prospect en decouverte", () => {
    const prompt = promptDe(
      entreesModeA({ type_appel: "decouverte" }),
    ).toLowerCase();

    expect(prompt).toContain("tu attends que ton interlocuteur ouvre");
    expect(prompt).not.toContain("tu decroches et tu parles en premier");
  });
});

describe("mode B — prospect reel", () => {
  it("injecte le texte LinkedIn colle", () => {
    const prompt = promptDe(entreesModeB());

    expect(prompt).toContain("Camille Dubreuil");
  });

  it("interdit d'inventer des faits hors des textes colles", () => {
    const prompt = promptDe(entreesModeB()).toLowerCase();

    expect(prompt).toContain("n'invente aucun fait");
  });

  it("ajoute le bloc memoire quand des echanges precedents sont fournis", () => {
    const prompt = promptDe(
      entreesModeB({ texte_echanges: "Bonjour, merci pour votre message." }),
    ).toLowerCase();

    expect(prompt).toContain("souvenir");
    expect(prompt).toContain("ne recite jamais");
  });

  it("omet le bloc memoire quand aucun echange n'est fourni", () => {
    const prompt = promptDe(entreesModeB()).toLowerCase();

    expect(prompt).not.toContain("souvenir");
  });

  it("omet les blocs des textes optionnels absents", () => {
    const prompt = promptDe(entreesModeB()).toLowerCase();

    expect(prompt).not.toContain("site de l'entreprise");
    expect(prompt).not.toContain("contexte fourni");
  });

  it("inclut les blocs des textes optionnels fournis", () => {
    const prompt = promptDe(
      entreesModeB({
        texte_site: "Fonderie Vallet, pieces techniques depuis 1954.",
        texte_contexte: "Rencontre au salon de Lyon.",
      }),
    );

    expect(prompt).toContain("Fonderie Vallet, pieces techniques depuis 1954.");
    expect(prompt).toContain("Rencontre au salon de Lyon.");
  });
});

describe("bornage des textes colles", () => {
  it("tronque un texte surdimensionne sans casser la structure", () => {
    const enorme = "x".repeat(LONGUEUR_MAX_TEXTE_COLLE * 3);
    const prompt = promptDe(entreesModeB({ texte_linkedin: enorme }));

    expect(prompt).not.toContain(enorme);
    expect(prompt.toLowerCase()).toContain("n'invente aucun fait");
    expect(prompt).toContain("maintenance Power BI en abonnement pour PME");
  });
});

describe("validation des entrees", () => {
  it("refuse un champ obligatoire vide en mode A", () => {
    expect(champsEnErreur(entreesModeA({ offre: "   " }))).toContain("offre");
    expect(champsEnErreur(entreesModeA({ cible: "" }))).toContain("cible");
  });

  it("refuse le mode B sans texte LinkedIn", () => {
    expect(champsEnErreur(entreesModeB({ texte_linkedin: undefined }))).toContain(
      "texte_linkedin",
    );
    expect(champsEnErreur(entreesModeB({ texte_linkedin: "  " }))).toContain(
      "texte_linkedin",
    );
  });

  it("exige les champs du mode A meme en mode B", () => {
    expect(champsEnErreur(entreesModeB({ offre: "" }))).toContain("offre");
  });

  it("refuse une difficulte hors 1-3", () => {
    const entrees = entreesModeA({ difficulte: 5 as 1 | 2 | 3 });

    expect(champsEnErreur(entrees)).toContain("difficulte");
  });

  it("n'accepte pas de texte colle en mode A", () => {
    const entrees = entreesModeA({ texte_linkedin: "un profil colle" });

    expect(champsEnErreur(entrees)).toContain("texte_linkedin");
  });
});
