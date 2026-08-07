import { afterEach, describe, expect, it } from "vitest";

import {
  LlmNotConfiguredError,
  resetLlmClient,
  resolveLlmClient,
  setLlmClient,
} from "@/lib/llm/registry";
import type { LlmClient } from "@/lib/llm/types";

const fakeClient: LlmClient = {
  complete: async () => "reponse de test",
};

afterEach(() => {
  resetLlmClient();
});

describe("registre du LlmClient", () => {
  it("renvoie le client injecte", () => {
    setLlmClient(fakeClient);

    expect(resolveLlmClient()).toBe(fakeClient);
  });

  it("echoue avec une erreur typee quand aucun client n'est injecte", () => {
    expect(() => resolveLlmClient()).toThrow(LlmNotConfiguredError);
  });

  it("oublie le client apres un reset", () => {
    setLlmClient(fakeClient);
    resetLlmClient();

    expect(() => resolveLlmClient()).toThrow(LlmNotConfiguredError);
  });

  it("resout le client injecte sans aucune cle API dans l'environnement", () => {
    const cle = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      setLlmClient(fakeClient);
      expect(resolveLlmClient()).toBe(fakeClient);
    } finally {
      if (cle !== undefined) process.env.OPENAI_API_KEY = cle;
    }
  });
});
