import { afterEach, describe, expect, it } from "vitest";

import { LLM_TEXT_MODEL_PAR_DEFAUT, resolveTextModel } from "@/lib/llm/model";

const initial = process.env.OPENAI_TEXT_MODEL;

afterEach(() => {
  if (initial === undefined) delete process.env.OPENAI_TEXT_MODEL;
  else process.env.OPENAI_TEXT_MODEL = initial;
});

describe("modele texte", () => {
  it("retombe sur le modele le moins cher du catalogue quand rien n'est configure", () => {
    delete process.env.OPENAI_TEXT_MODEL;

    expect(resolveTextModel()).toBe("gpt-5-nano");
    expect(LLM_TEXT_MODEL_PAR_DEFAUT).toBe("gpt-5-nano");
  });

  it("respecte OPENAI_TEXT_MODEL pour permettre une montee en gamme sans toucher au code", () => {
    process.env.OPENAI_TEXT_MODEL = "gpt-5-mini";

    expect(resolveTextModel()).toBe("gpt-5-mini");
  });

  it("ignore une valeur vide ou blanche", () => {
    process.env.OPENAI_TEXT_MODEL = "   ";

    expect(resolveTextModel()).toBe("gpt-5-nano");
  });
});
