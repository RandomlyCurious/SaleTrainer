import { afterEach, describe, expect, it, vi } from "vitest";

import { creerClientOpenAI } from "@/lib/llm/openai";
import { LlmIndisponibleError, LlmRefusError } from "@/lib/llm/types";

/**
 * Client OpenAI (#6) — `fetch` injecté, AUCUN appel réseau réel.
 *
 * Les assertions portent sur la forme exacte de la requête : `text.format`
 * (et non `response_format`), `strict: true`, endpoint `/v1/responses`.
 * Source : guide « Structured model outputs », relevé le 2026-08-07.
 */

const CLE_INITIALE = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = CLE_INITIALE;
  vi.restoreAllMocks();
});

function reponseOk(texte: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: texte }],
        },
      ],
    }),
  } as unknown as Response;
}

function fetchQuiRepond(reponse: Response) {
  return vi.fn(async () => reponse) as unknown as typeof fetch;
}

function entree() {
  return {
    messages: [
      { role: "system" as const, content: "consigne" },
      { role: "user" as const, content: "demande" },
    ],
    jsonSchema: { nom: "persona_json", schema: { type: "object" } },
  };
}

describe("construction de la requete", () => {
  it("appelle l'endpoint Responses avec la cle en en-tete", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond(reponseOk("{}"));

    await creerClientOpenAI({ fetchImpl: faux }).complete(entree());

    const [url, init] = (faux as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((init as RequestInit).method).toBe("POST");
    expect(
      (init as RequestInit).headers as Record<string, string>,
    ).toMatchObject({ Authorization: "Bearer cle-de-test" });
  });

  it("transmet le schema en sortie structuree stricte", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond(reponseOk("{}"));

    await creerClientOpenAI({ fetchImpl: faux }).complete(entree());

    const [, init] = (faux as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const corps = JSON.parse((init as RequestInit).body as string);

    // `text.format`, pas `response_format` : c'est la forme de l'API Responses.
    expect(corps.text.format).toMatchObject({
      type: "json_schema",
      name: "persona_json",
      strict: true,
    });
    expect(corps.response_format).toBeUndefined();
    expect(corps.text.format.schema).toEqual({ type: "object" });
  });

  it("transmet les messages et le modele configure", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    delete process.env.OPENAI_TEXT_MODEL;
    const faux = fetchQuiRepond(reponseOk("{}"));

    await creerClientOpenAI({ fetchImpl: faux }).complete(entree());

    const [, init] = (faux as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const corps = JSON.parse((init as RequestInit).body as string);

    expect(corps.model).toBe("gpt-5-nano");
    expect(corps.input).toEqual([
      { role: "system", content: "consigne" },
      { role: "user", content: "demande" },
    ]);
  });

  it("omet le bloc de sortie structuree quand aucun schema n'est fourni", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond(reponseOk("texte libre"));

    await creerClientOpenAI({ fetchImpl: faux }).complete({
      messages: [{ role: "user", content: "demande" }],
    });

    const [, init] = (faux as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(JSON.parse((init as RequestInit).body as string).text).toBeUndefined();
  });
});

describe("lecture de la reponse", () => {
  it("renvoie le texte de sortie", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond(reponseOk('{"nom_complet":"Camille"}'));

    const texte = await creerClientOpenAI({ fetchImpl: faux }).complete(
      entree(),
    );

    expect(texte).toBe('{"nom_complet":"Camille"}');
  });

  it("leve une erreur typee sur un refus du modele", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond({
      ok: true,
      status: 200,
      json: async () => ({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "refusal", refusal: "je ne peux pas" }],
          },
        ],
      }),
    } as unknown as Response);

    await expect(
      creerClientOpenAI({ fetchImpl: faux }).complete(entree()),
    ).rejects.toBeInstanceOf(LlmRefusError);
  });

  it("leve une erreur typee sur une reponse tronquee", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond({
      ok: true,
      status: 200,
      json: async () => ({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"nom_comp' }],
          },
        ],
      }),
    } as unknown as Response);

    await expect(
      creerClientOpenAI({ fetchImpl: faux }).complete(entree()),
    ).rejects.toBeInstanceOf(LlmIndisponibleError);
  });

  it("leve une erreur typee sur un statut HTTP en echec", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "rate limited" } }),
    } as unknown as Response);

    await expect(
      creerClientOpenAI({ fetchImpl: faux }).complete(entree()),
    ).rejects.toBeInstanceOf(LlmIndisponibleError);
  });

  it("leve une erreur typee quand la sortie ne contient aucun texte", async () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    const faux = fetchQuiRepond({
      ok: true,
      status: 200,
      json: async () => ({ status: "completed", output: [] }),
    } as unknown as Response);

    await expect(
      creerClientOpenAI({ fetchImpl: faux }).complete(entree()),
    ).rejects.toBeInstanceOf(LlmIndisponibleError);
  });
});

describe("configuration", () => {
  it("leve une erreur typee quand la cle est absente, sans appeler fetch", async () => {
    delete process.env.OPENAI_API_KEY;
    const faux = fetchQuiRepond(reponseOk("{}"));

    await expect(
      creerClientOpenAI({ fetchImpl: faux }).complete(entree()),
    ).rejects.toBeInstanceOf(LlmIndisponibleError);
    expect(faux).not.toHaveBeenCalled();
  });

  it("ne lit pas la cle a la construction", () => {
    delete process.env.OPENAI_API_KEY;

    expect(() => creerClientOpenAI()).not.toThrow();
  });
});
