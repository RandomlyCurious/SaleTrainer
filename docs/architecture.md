# Architecture

À maintenir à jour à CHAQUE changement structurel (règle CLAUDE.md).

## Structure des dossiers
```
src/app/             # App Router (pages, layouts, route handlers)
src/lib/supabase/    # env + fabriques de clients (navigateur / serveur)
src/lib/llm/         # contrat LlmClient, registre d'injection, modèle texte
tests/               # tests unitaires / intégration (Vitest + jsdom)
  setup.ts           # matchers jest-dom + cleanup RTL
e2e/                 # parcours critiques (Playwright)
docs/specs/          # une spec par feature, source de vérité du travail
supabase/migrations/ # migrations SQL (une par changement, jamais modifiée après application)
```

## Frontières (ce qui est délégué)
- Paiement → Stripe Checkout hébergé. En base : `customer_id` + statut, rien d'autre.
- Auth → Supabase Auth. Aucun mot de passe ne transite par notre code.
- Emails → outil externe (à choisir au premier besoin).

## Chaîne de tests
- `npm test` → Vitest en mode run, environnement jsdom, alias `@/*` → `src/*`.
- `npm run test:e2e` → Playwright. En local il lance `npm run dev` ; en CI il fait
  `npm run build && npm run start` et teste donc le build de prod.
- Couverture : `npm test -- --coverage` (provider v8, périmètre `src/**`).

## Accès aux services externes

Deux règles gouvernent tout accès sortant : **rien ne se construit à l'import**, et
**aucun secret n'atteint le navigateur**.

### Supabase
- `src/lib/supabase/env.ts` — lit `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  et renvoie `null` si l'une manque. **Ne lève jamais** : le build CI tourne sans secrets,
  une exception à l'import casserait `npm run build`.
- `src/lib/supabase/client.ts` — client navigateur (clé anon). Construit à l'appel.
- `src/lib/supabase/server.ts` — client serveur adossé aux cookies de la requête ; c'est lui
  qui porte la session, donc `auth.uid()`, donc l'accès sous RLS.
- La `service_role` ne transite jamais côté client. Elle ne sert qu'aux tests d'intégration
  RLS et à l'administration.

### OpenAI
- `src/lib/llm/types.ts` — interface `LlmClient`, seul point de contact avec le LLM texte.
- `src/lib/llm/registry.ts` — `setLlmClient` / `resolveLlmClient`. Aucune clé lue, aucun
  client construit à l'import. **C'est ce qui permet à la CI de tourner sans clé** : les tests
  injectent un double, et `resolveLlmClient()` lève une erreur typée si rien n'est enregistré.
  L'implémentation OpenAI réelle est enregistrée au ticket #6.
- `src/lib/llm/model.ts` — modèle texte, `gpt-5-nano` par défaut, surchargeable par
  `OPENAI_TEXT_MODEL`.
- La voix temps réel (#12) passe par un **jeton éphémère** généré par une route handler
  serveur : la clé OpenAI ne doit jamais atteindre le navigateur.

## Flux d'auth et schéma BDD
Schéma et policies : ticket #2 (migration 001). Flux d'auth magic link : ticket #3.
Toute table exposée = policies RLS obligatoires.
