import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLlmClient, setLlmClient } from "@/lib/llm/registry";
import { LlmIndisponibleError, LlmRefusError } from "@/lib/llm/types";
import type { LlmClient, LlmCompletionInput } from "@/lib/llm/types";
import {
  construireMessagesGeneration,
  genererPersona,
  TENTATIVES_MAX,
} from "@/lib/persona/generation";
import type { EntreesPersona } from "@/lib/persona/prompt";

/**
 * Génération du persona (#6).
 *
 * TOUS les cas passent par un double injecté : aucun appel réseau, jamais.
 */

afterEach(() => {
  resetLlmClient();
});

function entreesModeA(surcharge: Partial<EntreesPersona> = {}): EntreesPersona {
  return {
    mode: "generique",
    offre: "maintenance Power BI en abonnement pour PME",
    cible: "DAF de PME industrielle",
    type_appel: "cold_call",
    difficulte: 2,
    ...surcharge,
  };
}

function entreesModeB(): EntreesPersona {
  return {
    ...entreesModeA(),
    mode: "reel",
    texte_linkedin: "Camille Dubreuil — DAF chez Fonderie Vallet depuis 2021.",
  };
}

function personaConforme(surcharge: Record<string, unknown> = {}) {
  return {
    nom_complet: "Camille Dubreuil",
    role: "Directrice administrative et financiere",
    entreprise: { nom: "Fonderie Vallet", secteur: "industrie", taille: "120" },
    humeur: {
      niveau: 2,
      libelle: "sceptique",
      description: "Pressee, peu disponible.",
    },
    objections_probables: [
      { intitule: "Envoyez un mail", declencheur: "des l'ouverture" },
      { intitule: "On a deja quelqu'un", declencheur: "sur le perimetre" },
      { intitule: "Trop cher", declencheur: "des que le prix arrive" },
    ],
    conditions_raccrochage: ["si l'appel s'eternise sans interet"],
    ancrages: [],
    ...surcharge,
  };
}

/** Double qui rend les sorties fournies, dans l'ordre. */
function doubleQuiRend(...sorties: string[]): LlmClient & {
  appels: LlmCompletionInput[];
} {
  const appels: LlmCompletionInput[] = [];
  let index = 0;
  return {
    appels,
    async complete(entree: LlmCompletionInput) {
      appels.push(entree);
      return sorties[Math.min(index++, sorties.length - 1)];
    },
  };
}

function doubleQuiLeve(erreur: Error): LlmClient {
  return {
    async complete() {
      throw erreur;
    },
  };
}

describe("messages de generation", () => {
  it("reprend l'offre, la cible et la difficulte demandee", () => {
    const messages = construireMessagesGeneration(entreesModeA());
    const complet = messages.map((m) => m.content).join("\n");

    expect(complet).toContain("maintenance Power BI en abonnement pour PME");
    expect(complet).toContain("DAF de PME industrielle");
    expect(complet).toContain("2");
  });

  it("injecte les textes colles en mode B", () => {
    const messages = construireMessagesGeneration(entreesModeB());
    const complet = messages.map((m) => m.content).join("\n");

    expect(complet).toContain("Camille Dubreuil");
  });

  it("n'evoque aucun texte colle en mode A", () => {
    const complet = construireMessagesGeneration(entreesModeA())
      .map((m) => m.content)
      .join("\n")
      .toLowerCase();

    expect(complet).not.toContain("linkedin");
  });
});

describe("chemin nominal", () => {
  it("renvoie un persona type quand la sortie est conforme", async () => {
    const double = doubleQuiRend(JSON.stringify(personaConforme()));

    const resultat = await genererPersona(entreesModeA(), { client: double });

    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      expect(resultat.persona.nom_complet).toBe("Camille Dubreuil");
    }
    expect(double.appels).toHaveLength(1);
  });

  it("demande une sortie structuree stricte au modele", async () => {
    const double = doubleQuiRend(JSON.stringify(personaConforme()));

    await genererPersona(entreesModeA(), { client: double });

    expect(double.appels[0].jsonSchema?.nom).toBe("persona_json");
    expect(double.appels[0].jsonSchema?.schema).toBeDefined();
  });

  it("utilise le client injecte dans le registre quand aucun n'est passe", async () => {
    const double = doubleQuiRend(JSON.stringify(personaConforme()));
    setLlmClient(double);

    const resultat = await genererPersona(entreesModeA());

    expect(resultat.ok).toBe(true);
    expect(double.appels).toHaveLength(1);
  });
});

describe("sortie invalide — le filet", () => {
  it("rejoue une fois apres un JSON malforme, puis reussit", async () => {
    const double = doubleQuiRend(
      "{ ceci n'est pas du JSON",
      JSON.stringify(personaConforme()),
    );

    const resultat = await genererPersona(entreesModeA(), { client: double });

    expect(resultat.ok).toBe(true);
    expect(double.appels).toHaveLength(2);
  });

  it("rejoue une fois apres une sortie hors contrat, puis reussit", async () => {
    const double = doubleQuiRend(
      JSON.stringify(personaConforme({ objections_probables: [] })),
      JSON.stringify(personaConforme()),
    );

    const resultat = await genererPersona(entreesModeA(), { client: double });

    expect(resultat.ok).toBe(true);
    expect(double.appels).toHaveLength(2);
  });

  it("abandonne sur une erreur typee apres deux sorties invalides", async () => {
    const double = doubleQuiRend("pas du JSON", "toujours pas du JSON");

    const resultat = await genererPersona(entreesModeA(), { client: double });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.erreur.type).toBe("sortie_invalide");
      if (resultat.erreur.type === "sortie_invalide") {
        expect(resultat.erreur.tentatives).toBe(TENTATIVES_MAX);
      }
    }
    expect(double.appels).toHaveLength(TENTATIVES_MAX);
  });

  it("abandonne sur une erreur typee apres deux sorties hors contrat", async () => {
    const horsContrat = JSON.stringify(
      personaConforme({ humeur: { niveau: 3, libelle: "difficile", description: "x" } }),
    );
    const double = doubleQuiRend(horsContrat, horsContrat);

    const resultat = await genererPersona(entreesModeA(), { client: double });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok && resultat.erreur.type === "sortie_invalide") {
      expect(resultat.erreur.erreurs.map((e) => e.chemin)).toContain(
        "humeur.niveau",
      );
    }
  });

  it("applique la regle des ancrages selon le mode", async () => {
    const sansAncrage = JSON.stringify(personaConforme());
    const double = doubleQuiRend(sansAncrage, sansAncrage);

    const resultat = await genererPersona(entreesModeB(), { client: double });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok && resultat.erreur.type === "sortie_invalide") {
      expect(resultat.erreur.erreurs.map((e) => e.chemin)).toContain("ancrages");
    }
  });
});

describe("panne du LLM", () => {
  it("renvoie une erreur typee quand l'appel echoue", async () => {
    const double = doubleQuiLeve(new LlmIndisponibleError("timeout"));

    const resultat = await genererPersona(entreesModeA(), { client: double });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.erreur.type).toBe("llm_indisponible");
  });

  it("ne rejoue pas apres un refus du modele", async () => {
    let appels = 0;
    const double: LlmClient = {
      async complete() {
        appels += 1;
        throw new LlmRefusError();
      },
    };

    const resultat = await genererPersona(entreesModeA(), { client: double });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.erreur.type).toBe("llm_refus");
    expect(appels).toBe(1);
  });
});

describe("entrees invalides", () => {
  it("refuse le mode B sans texte LinkedIn, sans appeler le LLM", async () => {
    const double = doubleQuiRend(JSON.stringify(personaConforme()));

    const resultat = await genererPersona(
      { ...entreesModeB(), texte_linkedin: undefined },
      { client: double },
    );

    expect(resultat.ok).toBe(false);
    if (!resultat.ok && resultat.erreur.type === "entrees_invalides") {
      expect(resultat.erreur.champs).toContain("texte_linkedin");
    }
    expect(double.appels).toHaveLength(0);
  });
});

describe("confidentialite", () => {
  it("n'ecrit aucun payload ni texte colle dans les logs", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const double = doubleQuiRend("pas du JSON", "toujours pas");

    await genererPersona(entreesModeB(), { client: double });

    expect(journal).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    journal.mockRestore();
    info.mockRestore();
  });
});
