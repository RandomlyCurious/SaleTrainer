/**
 * Schéma JSON strict du contrat `persona_json` (annexe A.1, GELÉE), au format
 * attendu par les sorties structurées d'OpenAI (`text.format`, `strict: true`).
 *
 * Contraintes du mode strict, relevées sur le guide officiel le 2026-08-07 et
 * vérifiées par `tests/persona/schema-json.test.ts` :
 * - `additionalProperties: false` sur CHAQUE objet ;
 * - toutes les propriétés listées dans `required` — pas de champ optionnel,
 *   le nullable se simule par une union `["string", "null"]` ;
 * - `minItems` / `maxItems` / `minLength` NON SUPPORTÉS.
 *
 * Ce dernier point est structurant : le schéma garantit la FORME (types, clés,
 * énumérations) mais AUCUNE cardinalité. « Exactement 3 objections », « 1 à 4
 * conditions », « ancrages vides en mode A » restent à la charge du validateur
 * de #4. Les sorties structurées réduisent le bruit, elles ne remplacent pas
 * le contrat.
 */

export const NOM_SCHEMA_PERSONA = "persona_json";

const CHAINE = { type: "string" } as const;

export const SCHEMA_PERSONA_JSON: Record<string, unknown> = {
  type: "object",
  properties: {
    nom_complet: CHAINE,
    role: CHAINE,
    entreprise: {
      type: "object",
      properties: {
        nom: CHAINE,
        secteur: CHAINE,
        // Seule valeur nullable du contrat.
        taille: { type: ["string", "null"] },
      },
      required: ["nom", "secteur", "taille"],
      additionalProperties: false,
    },
    humeur: {
      type: "object",
      properties: {
        niveau: { type: "integer", enum: [1, 2, 3] },
        libelle: { type: "string", enum: ["ouvert", "sceptique", "difficile"] },
        description: CHAINE,
      },
      required: ["niveau", "libelle", "description"],
      additionalProperties: false,
    },
    objections_probables: {
      type: "array",
      // Le « exactement 3 » n'est pas exprimable ici : c'est #4 qui le tient.
      items: {
        type: "object",
        properties: { intitule: CHAINE, declencheur: CHAINE },
        required: ["intitule", "declencheur"],
        additionalProperties: false,
      },
    },
    conditions_raccrochage: { type: "array", items: CHAINE },
    ancrages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fait: CHAINE,
          source: {
            type: "string",
            enum: ["linkedin", "site", "contexte", "echanges"],
          },
        },
        required: ["fait", "source"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "nom_complet",
    "role",
    "entreprise",
    "humeur",
    "objections_probables",
    "conditions_raccrochage",
    "ancrages",
  ],
  additionalProperties: false,
};
