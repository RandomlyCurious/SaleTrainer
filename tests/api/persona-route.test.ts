import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLlmClient, setLlmClient } from "@/lib/llm/registry";
import { LlmIndisponibleError, type LlmClient } from "@/lib/llm/types";
import { POST } from "@/app/api/persona/route";

/**
 * Route de génération du persona (#6).
 *
 * Elle existe pour que la clé OpenAI ne quitte jamais le serveur. Le LLM est
 * toujours un double injecté : aucun appel réseau.
 */

afterEach(() => {
  resetLlmClient();
  vi.restoreAllMocks();
});

function entreesModeA() {
  return {
    mode: "generique",
    offre: "maintenance Power BI en abonnement pour PME",
    cible: "DAF de PME industrielle",
    type_appel: "cold_call",
    difficulte: 2,
  };
}

function personaConforme() {
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
    conditions_raccrochage: ["si l'appel s'eternise"],
    ancrages: [],
  };
}

function doubleQuiRend(...sorties: string[]): LlmClient {
  let index = 0;
  return {
    async complete() {
      return sorties[Math.min(index++, sorties.length - 1)];
    },
  };
}

function requete(corps: unknown): Request {
  return new Request("http://localhost/api/persona", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
}

describe("POST /api/persona", () => {
  it("renvoie 200 et le persona quand la generation reussit", async () => {
    setLlmClient(doubleQuiRend(JSON.stringify(personaConforme())));

    const reponse = await POST(requete(entreesModeA()));

    expect(reponse.status).toBe(200);
    await expect(reponse.json()).resolves.toMatchObject({
      persona: { nom_complet: "Camille Dubreuil" },
    });
  });

  it("renvoie 400 sur des entrees invalides, sans appeler le LLM", async () => {
    let appels = 0;
    setLlmClient({
      async complete() {
        appels += 1;
        return "{}";
      },
    });

    const reponse = await POST(requete({ ...entreesModeA(), offre: "" }));

    expect(reponse.status).toBe(400);
    await expect(reponse.json()).resolves.toMatchObject({
      erreur: "entrees_invalides",
    });
    expect(appels).toBe(0);
  });

  it("renvoie 400 sur un corps qui n'est pas du JSON", async () => {
    const reponse = await POST(
      new Request("http://localhost/api/persona", {
        method: "POST",
        body: "ceci n'est pas du JSON",
      }),
    );

    expect(reponse.status).toBe(400);
  });

  it("renvoie 502 quand le modele rend deux sorties invalides", async () => {
    setLlmClient(doubleQuiRend("pas du JSON", "toujours pas"));

    const reponse = await POST(requete(entreesModeA()));

    expect(reponse.status).toBe(502);
    await expect(reponse.json()).resolves.toMatchObject({
      erreur: "sortie_invalide",
    });
  });

  it("renvoie 503 quand le LLM est indisponible", async () => {
    setLlmClient({
      async complete() {
        throw new LlmIndisponibleError("OPENAI_API_KEY absente");
      },
    });

    const reponse = await POST(requete(entreesModeA()));

    expect(reponse.status).toBe(503);
  });

  it("n'expose jamais les textes colles ni la sortie du modele dans sa reponse", async () => {
    setLlmClient(doubleQuiRend("pas du JSON", "toujours pas"));

    const reponse = await POST(
      requete({
        ...entreesModeA(),
        mode: "reel",
        texte_linkedin: "Camille Dubreuil, DAF chez Fonderie Vallet",
      }),
    );
    const corps = JSON.stringify(await reponse.json());

    expect(corps).not.toContain("Fonderie Vallet");
    expect(corps).not.toContain("toujours pas");
  });

  it("n'ecrit rien dans les logs", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    setLlmClient(doubleQuiRend("pas du JSON", "toujours pas"));

    await POST(requete(entreesModeA()));

    expect(erreur).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
