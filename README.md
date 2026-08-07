# Template repo — Vibe coding encadré (SDD + TDD)

La boucle de travail (spec → ticket → RED → GREEN → refactor → PR) est décrite
une seule fois, dans [CLAUDE.md § Workflow — TDD STRICT](CLAUDE.md#workflow--tdd-strict-toujours-dans-cet-ordre).

## Démarrer un nouveau projet depuis ce template
```bash
npm ci                              # stack déjà scaffoldée, lock commité
npx playwright install chromium     # une fois par machine
cp .env.example .env.local          # remplir les clés Supabase
npm run dev
```
`npm ci` pose lui-même `core.hooksPath` (script `prepare`) : le pre-commit et le
commit-msg sont actifs sans geste manuel.

Supabase n'est pas initialisé dans ce template — lancer `supabase init` au premier ticket BDD.

Puis : renommer `name` dans `package.json`, vider `docs/decisions.md`, et supprimer
les tests de fumée (`tests/smoke.test.tsx`, `e2e/smoke.spec.ts`) dès la première feature.

### Réglages GitHub à faire à la main (NON hérités du template)
Un template ne transporte ni les réglages du dépôt ni les secrets. À faire une fois,
sinon les garde-fous locaux sont les seuls en place :
- [ ] **Branch protection sur `main`** (Settings → Branches → Add rule) :
  - [ ] Require a pull request before merging
  - [ ] Require status checks to pass : `quality-gates` **et** `e2e`
- [ ] **Secrets Actions** (Settings → Secrets and variables → Actions) :
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Stack en place
Next 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · Vitest 4 + Testing Library ·
Playwright · ESLint 9 (flat config). Détails : [docs/architecture.md](docs/architecture.md).

## Commandes
| | |
|---|---|
| `npm run dev` | serveur de dev |
| `npm test` | Vitest (mode run) |
| `npm run test:e2e` | Playwright |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | build de prod (gate CI bloquant) |
| `supabase start` / `supabase db reset` | BDD locale |
| `supabase db diff -f <nom>` | générer une migration |

## Maintenance du template
Rafraîchir les versions ~tous les 6 mois : `npm outdated`, bump, relancer les 5 gates,
et vérifier que `npm audit --audit-level=critical` passe toujours.
