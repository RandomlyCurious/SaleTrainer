import { resolveTextModel } from "./model";
import { peekLlmClient } from "./registry";
import {
  LlmIndisponibleError,
  LlmRefusError,
  type LlmClient,
  type LlmCompletionInput,
} from "./types";

/**
 * Implémentation `LlmClient` adossée à l'API Responses d'OpenAI (#6).
 *
 * `fetch` direct, pas de SDK : un seul appel, aucune dépendance à justifier.
 *
 * La clé est lue à l'APPEL, jamais à la construction ni à l'import — le build
 * CI tourne sans secret. Aucun payload, aucune sortie, aucun message d'erreur
 * de l'API ne transite par les logs : ils portent les textes collés, donc de
 * la PII en mode B.
 *
 * Forme de la requête relevée sur le guide « Structured model outputs » le
 * 2026-08-07 : endpoint `/v1/responses`, bloc `text.format` (et NON
 * `response_format`, qui est la forme de Chat Completions).
 */

const URL_RESPONSES = "https://api.openai.com/v1/responses";

export type OptionsClientOpenAI = {
  /** Injectable pour les tests : aucun appel réseau réel n'est jamais fait. */
  fetchImpl?: typeof fetch;
};

type PartieDeContenu = {
  type?: string;
  text?: string;
  refusal?: string;
};

type ElementDeSortie = {
  type?: string;
  content?: PartieDeContenu[];
};

type ReponseResponses = {
  status?: string;
  output?: ElementDeSortie[];
};

function corpsDeRequete(entree: LlmCompletionInput): string {
  const corps: Record<string, unknown> = {
    model: resolveTextModel(),
    input: entree.messages.map(({ role, content }) => ({ role, content })),
  };

  if (entree.maxOutputTokens !== undefined) {
    corps.max_output_tokens = entree.maxOutputTokens;
  }

  if (entree.jsonSchema !== undefined) {
    corps.text = {
      format: {
        type: "json_schema",
        name: entree.jsonSchema.nom,
        schema: entree.jsonSchema.schema,
        strict: true,
      },
    };
  }

  return JSON.stringify(corps);
}

function texteDeSortie(reponse: ReponseResponses): string {
  const parties = (reponse.output ?? [])
    .filter((element) => element.type === "message")
    .flatMap((element) => element.content ?? []);

  const refus = parties.find((partie) => partie.type === "refusal");
  if (refus !== undefined) throw new LlmRefusError();

  // La troncature est traitée AVANT la lecture du texte : une sortie coupée
  // est du JSON invalide, mais l'erreur utile est « tronquée », pas « malformée ».
  if (reponse.status === "incomplete") {
    throw new LlmIndisponibleError("réponse tronquée par le modèle");
  }

  const texte = parties.find((partie) => partie.type === "output_text")?.text;
  if (typeof texte !== "string" || texte.length === 0) {
    throw new LlmIndisponibleError("réponse sans texte exploitable");
  }

  return texte;
}

export function creerClientOpenAI(options: OptionsClientOpenAI = {}): LlmClient {
  const appeler = options.fetchImpl ?? fetch;

  return {
    async complete(entree: LlmCompletionInput): Promise<string> {
      const cle = process.env.OPENAI_API_KEY;
      if (typeof cle !== "string" || cle.trim().length === 0) {
        throw new LlmIndisponibleError("OPENAI_API_KEY absente");
      }

      let reponse: Response;
      try {
        reponse = await appeler(URL_RESPONSES, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cle.trim()}`,
            "Content-Type": "application/json",
          },
          body: corpsDeRequete(entree),
        });
      } catch {
        // La cause n'est pas remontée : elle peut contenir l'URL et des
        // en-têtes. Le statut suffit à diagnostiquer.
        throw new LlmIndisponibleError("appel réseau en échec");
      }

      if (!reponse.ok) {
        throw new LlmIndisponibleError(`réponse HTTP ${reponse.status}`);
      }

      return texteDeSortie((await reponse.json()) as ReponseResponses);
    },
  };
}

/**
 * Le client injecté s'il y en a un, sinon un client OpenAI.
 *
 * Construit à l'appel : aucun effet de bord à l'import, et un double injecté
 * par un test gagne toujours.
 */
export function clientLlmParDefaut(): LlmClient {
  return peekLlmClient() ?? creerClientOpenAI();
}
