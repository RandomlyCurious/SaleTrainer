import { describe, expect, it } from "vitest";

import type { ContextePersona } from "@/lib/persona/types";
import { validerPersona } from "@/lib/persona/validation";

/**
 * Contrat `persona_json` — annexe A.1 de la spec, GELÉE (#4).
 *
 * Chaque rejet doit être typé et porter le chemin fautif : le générateur (#6)
 * s'en sert pour décider s'il réessaie.
 */

const CONTEXTE_MODE_A: ContextePersona = { mode: "generique", difficulte: 2 };
const CONTEXTE_MODE_B: ContextePersona = { mode: "reel", difficulte: 2 };

function personaValide() {
  return {
    nom_complet: "Camille Dubreuil",
    role: "Directrice administrative et financiere",
    entreprise: { nom: "Fonderie Vallet", secteur: "industrie", taille: "120" },
    humeur: {
      niveau: 2,
      libelle: "sceptique",
      description: "Presse, poli mais peu disponible.",
    },
    objections_probables: [
      { intitule: "Envoyez-moi un mail", declencheur: "des l'ouverture" },
      { intitule: "On a deja quelqu'un", declencheur: "si on parle de perimetre" },
      { intitule: "C'est trop cher", declencheur: "des que le prix arrive" },
    ],
    conditions_raccrochage: ["si l'appel depasse cinq minutes sans interet"],
    ancrages: [],
  };
}

/** Persona mode B : identique, plus au moins un ancrage. */
function personaValideModeB() {
  return {
    ...personaValide(),
    ancrages: [{ fait: "A publie sur la refonte de son ERP", source: "linkedin" }],
  };
}

function cheminsEnErreur(resultat: ReturnType<typeof validerPersona>): string[] {
  return resultat.ok ? [] : resultat.erreurs.map((erreur) => erreur.chemin);
}

describe("persona conforme", () => {
  it("accepte un persona de mode A et le renvoie type", () => {
    const resultat = validerPersona(personaValide(), CONTEXTE_MODE_A);

    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      expect(resultat.persona.nom_complet).toBe("Camille Dubreuil");
      expect(resultat.persona.objections_probables).toHaveLength(3);
    }
  });

  it("accepte un persona de mode B avec ses ancrages", () => {
    const resultat = validerPersona(personaValideModeB(), CONTEXTE_MODE_B);

    expect(resultat.ok).toBe(true);
  });

  it("accepte une taille d'entreprise nulle", () => {
    const persona = personaValide();
    persona.entreprise.taille = null as unknown as string;

    expect(validerPersona(persona, CONTEXTE_MODE_A).ok).toBe(true);
  });
});

describe("forme du JSON", () => {
  it("rejette une valeur qui n'est pas un objet", () => {
    for (const valeur of [null, undefined, 42, "texte", []]) {
      expect(validerPersona(valeur, CONTEXTE_MODE_A).ok).toBe(false);
    }
  });

  it("rejette une cle inconnue", () => {
    const resultat = validerPersona(
      { ...personaValide(), commentaire_du_modele: "bonus" },
      CONTEXTE_MODE_A,
    );

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("commentaire_du_modele");
  });

  it("rejette un champ obligatoire manquant", () => {
    const persona: Record<string, unknown> = personaValide();
    delete persona.role;

    const resultat = validerPersona(persona, CONTEXTE_MODE_A);

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("role");
  });

  it("rejette une chaine vide ou blanche apres trim", () => {
    for (const valeur of ["", "   "]) {
      const resultat = validerPersona(
        { ...personaValide(), nom_complet: valeur },
        CONTEXTE_MODE_A,
      );

      expect(resultat.ok).toBe(false);
      expect(cheminsEnErreur(resultat)).toContain("nom_complet");
    }
  });
});

describe("humeur", () => {
  it("rejette un niveau hors 1-3", () => {
    for (const niveau of [0, 4, 2.5]) {
      const persona = personaValide();
      persona.humeur.niveau = niveau;

      const resultat = validerPersona(persona, CONTEXTE_MODE_A);
      expect(resultat.ok, `niveau ${niveau}`).toBe(false);
      expect(cheminsEnErreur(resultat)).toContain("humeur.niveau");
    }
  });

  it("rejette un niveau qui ne colle pas a la difficulte demandee", () => {
    const persona = personaValide();
    persona.humeur.niveau = 3;
    persona.humeur.libelle = "difficile";

    const resultat = validerPersona(persona, { mode: "generique", difficulte: 1 });

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("humeur.niveau");
  });

  it("rejette un libelle incoherent avec le niveau", () => {
    const persona = personaValide();
    persona.humeur.libelle = "ouvert";

    const resultat = validerPersona(persona, CONTEXTE_MODE_A);

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("humeur.libelle");
  });
});

describe("objections probables", () => {
  it("rejette un nombre d'objections different de 3", () => {
    for (const nombre of [0, 2, 4]) {
      const persona = personaValide();
      persona.objections_probables = personaValide().objections_probables.slice(
        0,
        nombre,
      );
      while (persona.objections_probables.length < nombre) {
        persona.objections_probables.push({
          intitule: "objection en trop",
          declencheur: "jamais",
        });
      }

      const resultat = validerPersona(persona, CONTEXTE_MODE_A);
      expect(resultat.ok, `${nombre} objections`).toBe(false);
      expect(cheminsEnErreur(resultat)).toContain("objections_probables");
    }
  });

  it("rejette une objection sans declencheur", () => {
    const persona = personaValide();
    persona.objections_probables[1].declencheur = "";

    const resultat = validerPersona(persona, CONTEXTE_MODE_A);

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain(
      "objections_probables[1].declencheur",
    );
  });
});

describe("conditions de raccrochage", () => {
  it("rejette une liste vide", () => {
    const resultat = validerPersona(
      { ...personaValide(), conditions_raccrochage: [] },
      CONTEXTE_MODE_A,
    );

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("conditions_raccrochage");
  });

  it("rejette plus de quatre conditions", () => {
    const resultat = validerPersona(
      {
        ...personaValide(),
        conditions_raccrochage: ["a", "b", "c", "d", "e"],
      },
      CONTEXTE_MODE_A,
    );

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("conditions_raccrochage");
  });

  it("accepte quatre conditions", () => {
    const resultat = validerPersona(
      {
        ...personaValide(),
        conditions_raccrochage: ["a", "b", "c", "d"],
      },
      CONTEXTE_MODE_A,
    );

    expect(resultat.ok).toBe(true);
  });
});

describe("ancrages", () => {
  it("rejette des ancrages non vides en mode A", () => {
    const resultat = validerPersona(personaValideModeB(), CONTEXTE_MODE_A);

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("ancrages");
  });

  it("rejette des ancrages vides en mode B", () => {
    const resultat = validerPersona(personaValide(), CONTEXTE_MODE_B);

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("ancrages");
  });

  it("rejette une source hors enumeration", () => {
    const persona = {
      ...personaValide(),
      ancrages: [{ fait: "un fait", source: "twitter" }],
    };

    const resultat = validerPersona(persona, CONTEXTE_MODE_B);

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toContain("ancrages[0].source");
  });

  it("accepte les quatre sources prevues", () => {
    for (const source of ["linkedin", "site", "contexte", "echanges"]) {
      const persona = {
        ...personaValide(),
        ancrages: [{ fait: "un fait", source }],
      };

      expect(validerPersona(persona, CONTEXTE_MODE_B).ok, source).toBe(true);
    }
  });
});

describe("rapport d'erreurs", () => {
  it("remonte toutes les erreurs, pas seulement la premiere", () => {
    const resultat = validerPersona(
      {
        ...personaValide(),
        nom_complet: "",
        conditions_raccrochage: [],
      },
      CONTEXTE_MODE_A,
    );

    expect(resultat.ok).toBe(false);
    expect(cheminsEnErreur(resultat)).toEqual(
      expect.arrayContaining(["nom_complet", "conditions_raccrochage"]),
    );
  });
});
