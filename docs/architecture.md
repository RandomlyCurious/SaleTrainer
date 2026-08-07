# Architecture

À maintenir à jour à CHAQUE changement structurel (règle CLAUDE.md).

## Structure des dossiers
```
src/app/             # App Router (pages, layouts, route handlers)
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

## Flux d'auth et schéma BDD
À décrire au premier ticket qui les introduit. Toute table exposée = policies RLS obligatoires.
