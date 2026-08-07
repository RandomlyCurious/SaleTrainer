# Spec : <nom de la feature>

> Statut : brouillon | validée | implémentée
> Date : YYYY-MM-DD

## Objectif (1-3 phrases)
Ce que l'utilisateur final peut faire après cette feature, et pourquoi.

## Périmètre exclu (ne PAS implémenter)
- ...

## Critères d'acceptation (deviennent les tests)
- [ ] Étant donné <contexte>, quand <action>, alors <résultat>
- [ ] Cas d'erreur : <entrée invalide> → <comportement>
- [ ] Cas limite : ...

## Hors périmètre découvert en cours de route
Toute idée, bug ou amélioration repérée PENDANT l'implémentation et absente
des critères ci-dessus : NE PAS l'implémenter. La noter ici, l'humain décidera
(nouvelle issue, nouvelle spec, ou poubelle) :
- ...

## Definition of Done
- Tous les critères ci-dessus couverts par un test qui passe
- CI verte (lint, typecheck, tests, build)
- RLS vérifiée si une table est exposée ; `docs/decisions.md` mis à jour si décision d'archi

<!-- Le découpage en tickets vit dans les GitHub Issues (template "Ticket"),
     pas ici : une seule source pour l'état d'avancement. -->
