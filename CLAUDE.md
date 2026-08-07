# CLAUDE.md — Règles du projet (NON NÉGOCIABLES)

## Stack
- Frontend : Next.js (App Router) + TypeScript strict + Tailwind
- Backend/BDD : Supabase (Postgres + RLS + Auth). AUCUNE autre BDD.
- Tests : Vitest (unit/intégration) + Playwright (e2e critiques)
- Paiement : Stripe via lien/checkout hébergé — ne JAMAIS manipuler de données carte.

## Règles data
- Source de vérité UNIQUE : Supabase. Pas de BDD locale ; le cache client (TanStack Query) est jetable et ne fait jamais autorité.
- Stocker les données utilisateur (nom, email, préférences, contenu métier) dans Supabase est NORMAL et autorisé, tant que : la table a ses policies RLS, et qu'on ne stocke que ce qui sert réellement l'app (minimisation).
- INTERDIT en base, quoi qu'il arrive : numéros de carte (Stripe s'en charge, on ne garde que customer_id + statut), mots de passe en clair (Supabase Auth), données de santé.
- LOGS : jamais de PII en clair (email, nom, IP) dans console.log, logs serveur ou outils de monitoring. Logger des IDs, pas des identités.

## Workflow — TDD STRICT (toujours dans cet ordre)
1. **SPEC** : lire la spec dans `docs/specs/` avant tout code. Si elle n'existe pas, la créer depuis `docs/specs/TEMPLATE.md` et la faire valider par l'humain. La spec porte le CONTRAT (objectif, périmètre, critères d'acceptation), pas l'avancement.
2. **TICKET** : les tickets vivent dans les GitHub Issues, seule source de l'avancement. Travailler UNE issue à la fois, dans l'ordre. Annoncer laquelle avant de commencer.
3. **RED** : écrire un test qui échoue décrivant le comportement attendu. Lancer `npm test`, montrer l'échec.
4. **COMMIT** des tests seuls : `test: <ticket> (red)`.
5. **GREEN** : implémenter le minimum pour passer au vert. INTERDIT de modifier les tests pour les faire passer.
6. **REFACTOR** : nettoyer, relancer TOUTE la suite (`npm test`), montrer la sortie.
7. **COMMIT** : Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`), cocher le ticket dans la spec.

## Anti scope creep
Tout ce qui n'est pas dans les critères d'acceptation de la spec ne s'implémente PAS,
même si c'est "évident", "rapide" ou "mieux". Le noter dans la section
"Hors périmètre découvert" de la spec et s'arrêter là. Un refactor opportuniste
hors ticket = interdit ; proposer un ticket dédié à la place.

## Interdits absolus
- Modifier un test existant pour le faire passer (sauf spec changée + accord humain explicite).
- Toucher aux fichiers de migration déjà appliqués (`supabase/migrations/*` existants). Nouvelle migration = nouveau fichier.
- Désactiver le lint, le typecheck, ou skipper des tests (`.skip`, `--no-verify`).
- Secrets en dur. Tout passe par `.env.local` (jamais commité) et les secrets GitHub Actions.
- `service_role` key côté client. Toute table exposée DOIT avoir ses policies RLS.
- Dépendance nouvelle sans la justifier en une phrase dans la PR.

## Preuves exigées
Ne jamais affirmer "ça marche" sans montrer la sortie de `npm test`.

## Commandes du projet
Liste complète dans le [README](README.md#commandes).

## Git — règles pour l'agent
- JAMAIS de commit direct sur main. Toujours vérifier la branche courante
  (git branch --show-current) avant tout commit.
- Une branche par ticket/feature, nommée : feat/<slug>, fix/<slug>,
  chore/<slug>, refactor/<slug> (slug court, kebab-case, sans accents).
- Créer la branche depuis main à jour : git switch main && git pull
  && git switch -c feat/<slug>
- Commits atomiques en Conventional Commits, référençant l'issue : (fixes #12).
- JAMAIS : push --force, --no-verify, rebase de branches déjà poussées,
  suppression de branche non mergée.
- Fin de ticket : push + proposer la PR (gh pr create), ne JAMAIS merger
  soi-même — le merge est une décision humaine après CI verte.

## Reprise de projet / legacy
Avant tout refactor d'un code non testé : écrire des **characterization tests**
qui capturent le comportement ACTUEL (même bugué), les commiter, puis refactorer.

## Contexte en couches
- Ce fichier = règles courtes et stables uniquement.
- Détails d'architecture : `docs/architecture.md`
- Décisions actées : `docs/decisions.md` (1 ligne par décision, datée)
- Spec de la feature en cours : `docs/specs/<feature>.md`
Lire ces fichiers AU DÉBUT de chaque session, ne pas les paraphraser ici.
