/**
 * Modèle texte utilisé pour la génération de persona et le debrief.
 *
 * `gpt-5-nano` est le moins cher du catalogue texte OpenAI ($0,05 / $0,40 par
 * million de tokens entrée/sortie, relevé le 2026-08-07). La spec demande « le
 * modèle le moins cher SUFFISANT » : on démarre au plancher, et la passation
 * manuelle (#16) dira s'il faut monter en gamme.
 *
 * Surchargeable par `OPENAI_TEXT_MODEL` pour que cette montée en gamme ne
 * demande pas de toucher au code.
 */

export const LLM_TEXT_MODEL_PAR_DEFAUT = "gpt-5-nano";

export function resolveTextModel(): string {
  const configure = process.env.OPENAI_TEXT_MODEL;
  if (typeof configure === "string" && configure.trim().length > 0) {
    return configure.trim();
  }
  return LLM_TEXT_MODEL_PAR_DEFAUT;
}
