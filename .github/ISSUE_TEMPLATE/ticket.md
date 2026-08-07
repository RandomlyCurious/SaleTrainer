---
name: Ticket (feature/tâche)
about: Unité de travail issue d'une spec — 30 min à 2 h max
title: "[T] <verbe + objet court>"
labels: ticket
---

## Problème / Besoin
Ce qui manque ou dysfonctionne aujourd'hui, du point de vue utilisateur ou technique.

## Objectif
Le résultat observable une fois le ticket fermé (1-2 phrases).
Spec parente : `docs/specs/<feature>.md`

## Résolution technique
- Fichiers/tables touchés :
- Migration Supabase ? oui/non
- Approche retenue (2-3 lignes max, le détail vit dans la spec) :

## Critères d'acceptation (= tests à écrire)
- [ ] Étant donné <contexte>, quand <action>, alors <résultat>
- [ ] Cas d'erreur :

## Hors scope de ce ticket
Ce qu'on ne fait PAS ici, même si c'est proche (renvoyer vers un autre ticket/issue).

## Definition of Done
- [ ] Tests écrits d'abord (commit red) puis verts
- [ ] typecheck + lint + CI verts
- [ ] Ticket coché dans la spec parente
