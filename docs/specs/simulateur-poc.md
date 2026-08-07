# Spec : Simulateur vocal d'appels de prospection B2B (POC v0)

> Statut : validée
> Date : 2026-08-07
>
> Cette spec remplace `docs/specs/spec-poc-simulateur-prospection.md` (renommé).
> Elle en reprend le contenu intégral, réorganisé au format `TEMPLATE.md`, avec les
> arbitrages du 2026-08-07 intégrés (voir `docs/decisions.md`).
> L'avancement vit dans les GitHub Issues, PAS ici.

## Objectif

Permettre à un utilisateur unique (le propriétaire du projet) de s'entraîner à un appel de
prospection ou de découverte B2B face à une IA qui joue le prospect en voix temps réel, puis
de recevoir un debrief scoré sur une grille fixe. Le POC valide deux hypothèses, rien d'autre :
(a) la simulation vocale est assez réaliste pour créer de l'inconfort utile, (b) le debrief
fait progresser.

**Différenciateur à valider dès la v0 :** le persona peut être construit à partir d'un VRAI
prospect (texte du profil LinkedIn + texte du site de sa boîte, collés par l'utilisateur).
Cas d'usage : « je répète MON appel de demain ».

## Stack imposée

- **Frontend :** Next.js (App Router) + TypeScript strict + Tailwind. Une seule app.
- **Voix temps réel :** OpenAI Realtime API (speech-to-speech, WebRTC). Pas de pipeline
  STT→LLM→TTS maison.
- **Backend/DB :** Supabase (Auth magic link + Postgres). RLS activée sur toutes les tables,
  policies mono-utilisateur (`auth.uid() = user_id`).
- **LLM texte (persona + debrief) :** OpenAI, modèle texte le moins cher du catalogue
  suffisant pour la tâche. Une seule clé, un seul fournisseur en v0. La référence exacte du
  modèle est figée au ticket T1 et consignée dans `docs/decisions.md`.
- Pas de n8n, pas de WeWeb en v0.

## Parcours utilisateur

### Écran 0 — Connexion
Supabase Auth, magic link par email. Une seule page. Aucun flow d'inscription, de
réinitialisation ou de gestion de compte au-delà.

### Écran 1 — Configurer la simulation

**Mode A — Persona générique.** Formulaire :
- Mon offre (texte libre, ex. « maintenance Power BI en abonnement pour PME »)
- Ma cible (texte libre, ex. « DAF de PME industrielle 50-200 personnes »)
- Type d'appel : `cold_call` / `decouverte` (RDV pris)
- Difficulté :
  - Niveau 1 « Ouvert » : prospect disponible, objections légères
  - Niveau 2 « Sceptique » : pressé, objections classiques (prix, « envoyez un mail »,
    « on a déjà quelqu'un »)
  - Niveau 3 « Difficile » : coupe la parole, mauvaise foi, peut raccrocher

**Mode B — Vrai prospect (killer feature).** Les quatre champs du mode A restent
**obligatoires**, plus quatre zones de collage (toutes optionnelles sauf la première) :
- « Profil LinkedIn du prospect » (copier-coller brut) — **obligatoire en mode B**
- « Site de sa boîte » (page d'accueil / à propos)
- « Mon contexte » : description libre (comment il connaît le prospect, historique du deal,
  ce qu'il sait par ailleurs)
- « Échanges précédents » : emails / messages LinkedIn déjà échangés, collés bruts

Le système génère un persona calibré : rôle réel, secteur, actualités visibles dans le profil,
objections plausibles pour CE contexte. **Le persona ne doit JAMAIS prétendre connaître des
informations absentes des textes collés.**

Si des échanges précédents sont fournis, l'appel s'inscrit dans leur continuité : le persona
SE SOUVIENT de ce qui a été dit/promis et peut s'y référer naturellement (« vous m'aviez parlé
de X »), mais ne récite jamais les messages et n'évoque ces éléments que quand c'est naturel
dans la conversation. Il peut relever une incohérence entre ce que dit l'utilisateur en appel
et ce qu'il avait écrit.

Un bouton « Générer le persona » affiche un **résumé** — nom, rôle, humeur, 3 objections
probables — que l'utilisateur peut regénérer, puis « Lancer l'appel ». Ce résumé est une VUE
du contrat `persona_json` (annexe A.1), pas un schéma distinct.

### Écran 2 — L'appel
- Interface minimale type appel téléphonique : nom du persona, timer, bouton raccrocher,
  indicateur « il parle / je parle ».
- L'IA décroche et parle en premier (« Allô ? ») en `cold_call` ; en `decouverte`, elle attend
  que l'utilisateur ouvre.
- Comportements obligatoires du persona : hésitations, interruptions (niveaux 2-3), objections
  placées à des moments non prévisibles, peut raccrocher si l'appel est mauvais (niveau 3) ou
  si l'utilisateur est hors sujet trop longtemps.
- Le raccrochage de l'IA passe par un **tool/function call** exposé au modèle Realtime
  (fallback : détection côté client sur silence prolongé). Jamais de phrase sentinelle.
- **Durée max : 10 minutes (600 s), coupure automatique.** C'est le seul garde-fou de coût v0.
- Tout l'audio est transcrit en continu ; le transcript est la matière du debrief.

### Écran 3 — Debrief
Déclenché **côté client, en synchrone**, à la fin de l'appel, à partir du transcript :

1. **Score global /10** et score par axe (grille fixe, /10 chacun) :
   - **Cadrage** : a posé le déroulé et l'objectif de l'appel dans les 60 premières secondes
   - **Découverte** : ratio questions/affirmations, qualité des questions (ouvertes, sur les enjeux)
   - **Écoute** : reformulations, rebonds sur ce que dit le prospect vs récitation d'un script
   - **Objections** : traitées sans paniquer, sans concession immédiate sur le prix
   - **Next step** : a obtenu un engagement daté et explicite avant de raccrocher
2. **3 moments clés** : citation du transcript + ce qui s'est joué + ce qu'il fallait dire
   (formulation exacte proposée)
3. **1 consigne pour le prochain appel** (une seule, la plus impactante)
4. Transcript complet consultable, replié par défaut.

Boutons : « Rejouer le même persona » (= nouvelle `session` sur le même `persona_id`) /
« Nouvelle simulation ».

### Écran annexe — Historique
Liste des sessions : date, persona, type d'appel, difficulté, score global, lien vers le
debrief. Un mini-graphique de l'évolution du score global, en **SVG écrit à la main** (pas de
librairie de charting). Rien de plus.

## Modèle de données (Supabase)

Les trois tables portent `user_id uuid not null references auth.users(id)` — **dénormalisé**
sur `sessions` et `debriefs` pour que les policies RLS n'aient pas à joindre. RLS activée sur
les trois, policies `select/insert/update/delete` sur `auth.uid() = user_id`.

- `personas` : `id`, `user_id`, `mode` (`generique`|`reel`), `offre`, `cible`, `type_appel`
  (`cold_call`|`decouverte`), `difficulte` (1|2|3), `texte_linkedin`, `texte_site`,
  `texte_contexte`, `texte_echanges`, `persona_json`, `created_at`
- `sessions` : `id`, `user_id`, `persona_id` → `personas`, `transcript_json`, `duree_sec`,
  `terminee_par` (`user`|`ia_raccroche`|`timeout`), `created_at`
- `debriefs` : `id`, `user_id`, `session_id` → `sessions`, `score_global`, `scores_json`,
  `moments_json`, `consigne`, `created_at`

**Invariant :** `debriefs.score_global` est égal à `scores_json.global`. La colonne existe pour
le tri et le graphique de l'historique ; le JSON reste la source du contrat.

## Annexe A — Contrats JSON figés

Ces quatre schémas sont le périmètre exact du TDD. Tout écart = rejet typé, jamais un objet
partiel. Chaînes : non vides après trim.

### A.1 — `persona_json` (contrat complet)

```jsonc
{
  "nom_complet": "string",
  "role": "string",                          // intitulé de poste
  "entreprise": {
    "nom": "string",
    "secteur": "string",
    "taille": "string | null"
  },
  "humeur": {
    "niveau": 1,                             // entier 1|2|3, recopie de personas.difficulte
    "libelle": "ouvert | sceptique | difficile",   // déterminé par niveau, pas libre
    "description": "string"                  // état d'esprit en une phrase
  },
  "objections_probables": [                  // EXACTEMENT 3
    { "intitule": "string", "declencheur": "string" }
  ],
  "conditions_raccrochage": ["string"],      // 1 à 4 entrées
  "ancrages": [                              // [] en mode A ; >= 1 en mode B
    { "fait": "string", "source": "linkedin | site | contexte | echanges" }
  ]
}
```

Règles validées par le code : `humeur.niveau` égale la difficulté demandée ;
`humeur.libelle` est cohérent avec `humeur.niveau` ; `objections_probables.length === 3` ;
`ancrages` vide en mode A, non vide en mode B. La véracité des `ancrages` (aucun fait
extérieur aux textes collés) relève de la passation manuelle, pas du test.

### A.2 — `scores_json`

```jsonc
{
  "global": 7,                               // entier 0-10
  "axes": {
    "cadrage": 6,                            // entiers 0-10, les 5 clés obligatoires
    "decouverte": 8,
    "ecoute": 7,
    "objections": 5,
    "next_step": 9
  }
}
```

Cinq axes fixes, aucune clé en plus, aucune en moins.

### A.3 — `moments_json`

```jsonc
[                                            // EXACTEMENT 3 entrées
  {
    "citation": "string",                    // extrait verbatim du transcript
    "analyse": "string",                     // ce qui s'est joué
    "formulation_proposee": "string"         // ce qu'il fallait dire, mot pour mot
  }
]
```

### A.4 — `transcript_json`

```jsonc
[                                            // liste ordonnée, ts_ms croissant
  { "role": "user | prospect", "text": "string", "ts_ms": 0 }
]
```

`ts_ms` : entier >= 0, millisecondes depuis le début de l'appel, croissant au sens large.
Deux tours consécutifs du même `role` sont fusionnés à la normalisation.

La consigne unique du debrief n'est pas du JSON : c'est la colonne `debriefs.consigne`,
une chaîne non vide.

## Prompts système (le cœur du produit)

**Prompt persona (Realtime).** Doit contenir : identité et contexte du prospect, humeur selon
la difficulté, règles de comportement (interrompre, hésiter avec des « euh », phrases courtes
et orales, jamais de listes, jamais d'aide à l'utilisateur, jamais sortir du rôle), conditions
de raccrochage, et l'interdiction d'inventer des faits sur le prospect réel hors des textes
fournis. Si des échanges précédents existent : le persona en connaît le contenu comme un
souvenir (pas comme un texte), s'y réfère avec parcimonie et uniquement quand c'est naturel,
et peut confronter l'utilisateur à une contradiction avec ses propres écrits. Le prospect parle
français courant, registre professionnel oral.

**Prompt debrief.** Reçoit le transcript + le contexte. Applique STRICTEMENT la grille des
5 axes (définitions incluses dans le prompt). Sortie en JSON structuré conforme à A.2/A.3.
Ton : direct, factuel, pas d'encouragements creux.

## Critères d'acceptation

### A — Vérifiables en test automatisé (deviennent les tests)

Sécurité / données
- [ ] Étant donné un client anon, quand il lit ou écrit `personas`/`sessions`/`debriefs`,
      alors 0 ligne lue et écriture refusée.
- [ ] Étant donné deux utilisateurs A et B, quand A liste ses personas, alors aucune ligne
      de B n'apparaît.
- [ ] Étant donné un debrief persisté, alors `score_global === scores_json.global`.

Contrats (annexe A)
- [ ] Étant donné un `persona_json` conforme, quand il est validé, alors accepté.
- [ ] Cas d'erreur : `objections_probables` de longueur ≠ 3, `humeur.niveau` hors 1-3,
      `libelle` incohérent avec `niveau`, `ancrages` non vide en mode A, `ancrages` vide en
      mode B, clé inconnue → rejet typé.
- [ ] Étant donné une sortie de debrief avec 4 moments, 2 consignes, un score à 11 ou un axe
      manquant, alors rejet typé.
- [ ] Étant donné des events de transcription désordonnés ou dupliqués, quand on normalise,
      alors `transcript_json` ordonné par `ts_ms` croissant, tours consécutifs du même rôle
      fusionnés.

Construction des prompts
- [ ] Étant donné le mode A, quand on construit le prompt persona, alors il contient le bloc
      d'humeur du niveau choisi et **aucun** bloc « prospect réel ».
- [ ] Étant donné le mode B avec échanges précédents, alors le prompt contient le bloc
      « mémoire des échanges » ; sans échanges collés, ce bloc est absent.
- [ ] Cas d'erreur : champ obligatoire vide (mode A ou mode B) → erreur avant tout appel LLM.

Robustesse des appels LLM
- [ ] Étant donné une sortie LLM JSON malformée, quand on génère le persona, alors 1 retry ;
      deux échecs → erreur typée, aucun persona partiel persisté.
- [ ] Étant donné un échec de génération du debrief, alors la session et son transcript
      restent consultables.

Fin d'appel
- [ ] Étant donné un appel qui dépasse 600 s, quand il se clôture, alors
      `terminee_par = "timeout"`.
- [ ] Étant donné le tool call de raccrochage émis par le modèle, alors
      `terminee_par = "ia_raccroche"` ; raccrochage utilisateur → `"user"`.

Bout en bout
- [ ] Parcours e2e complet (Realtime et LLM mockés) : connexion → config → persona → appel →
      debrief → historique.
- [ ] Aucun test n'effectue d'appel réseau réel vers OpenAI.

### B — Vérifiables en passation manuelle (ticket T16 : grille + 3 essais consignés)

Non automatisables : dépendent d'un modèle non déterministe et de la latence réseau réelle.

- [ ] Latence de réponse vocale perçue < 1,5 s dans des conditions normales.
- [ ] Le persona niveau 2 place au moins 2 objections non annoncées et coupe la parole au
      moins une fois par appel.
- [ ] Le persona niveau 3 raccroche effectivement sur un appel mauvais.
- [ ] En mode B, le persona mentionne spontanément au moins 1 élément issu du profil collé,
      et n'invente aucun fait extérieur aux textes collés.
- [ ] Le debrief arrive en < 30 s après la fin de l'appel, avec les 5 scores et la consigne
      unique.
- [ ] Je peux enchaîner 3 simulations sans toucher au code.

## Périmètre exclu (ne PAS implémenter)

Interdit d'y toucher en v0 : paiement/abonnement, **fonctionnalités** multi-utilisateurs
(partage, rôles, invitations), scraping automatique de LinkedIn, avatars vidéo, application
mobile, parcours gamifié, niveaux à débloquer, dashboard de progression avancé, intégrations
CRM, envoi d'emails, landing page marketing.

> Précision du 2026-08-07 : ce hors-scope vise les *fonctionnalités* multi-utilisateurs. La
> RLS mono-utilisateur est un verrou par défaut exigé par `CLAUDE.md`, pas une feature ; elle
> est dans le périmètre.

## Contraintes transverses

- **Logs — règle absolue :** aucun payload LLM, aucun texte collé, aucun transcript, aucune PII
  en clair dans `console.log`, les logs serveur ou le monitoring. On logge des IDs.
- **Secrets :** la clé OpenAI ne quitte jamais le serveur. La session Realtime passe par un
  **jeton éphémère** généré côté serveur (route handler dédiée).
- **Testabilité :** tout accès OpenAI (Realtime et texte) passe par une interface injectable,
  posée dès T1, pour que la CI tourne sans clé.
- **Périmètre du TDD :** contrats purs, prompts, normalisation, modèle de données. **Exempté :**
  le transport WebRTC/SDP/audio et le composant qui le pilote — et rien d'autre.

## Hors périmètre découvert en cours de route

Idées, bugs ou améliorations repérés PENDANT l'implémentation et absents des critères
ci-dessus : NE PAS les implémenter. Les noter ici, l'humain décidera.

- **Purge / rétention des données de tiers (v1).** Les textes collés et les transcripts
  contiennent des données personnelles d'un prospect qui n'a pas consenti. Accepté en v0
  (mono-utilisateur, usage privé) ; une politique de rétention et une purge sont à traiter
  avant toute ouverture à d'autres utilisateurs.
- **Perte du debrief si l'onglet est fermé.** Le debrief est déclenché côté client en
  synchrone (arbitrage v0). Si l'utilisateur ferme l'onglet pendant la génération, le debrief
  est perdu ; la session et son transcript restent consultables. Risque accepté en v0.
- **Garde-fous de coût.** Le cap de 10 minutes par appel est le seul en v0. Pas de quota
  journalier, pas de plafond de dépense.
- **Contrainte « mode B ⇒ `texte_linkedin` non nul » (repéré en #2).** Le parcours rend le
  profil LinkedIn obligatoire en mode `reel`, mais la base accepte un persona `reel` sans
  texte collé. Un CHECK conditionnel le fermerait au niveau des données. Absent des critères
  de #2 (qui ne listent que les CHECK d'énumération et de bornes), donc **non implémenté** —
  la règle est portée par la validation applicative (#5, #11).
- **Clé `sb_secret_…` collée nue (repéré en #21).** Aucune alternative de
  `scripts/scan-secrets.sh` n'attrape une clé Supabase du nouveau format collée **sans nom de
  variable en face** — elle n'est bloquée que dans une affectation. C'était déjà vrai avant
  #21, qui n'a pas élargi la détection. Un motif `sb_secret[_]` la couvrirait. Hors critères
  de #21, donc **non implémenté**.

## Definition of Done

- Tous les critères de la section **A** couverts par un test qui passe
- Les critères de la section **B** consignés dans la grille de passation (T16)
- CI verte (lint, typecheck, tests, build)
- RLS vérifiée par test pour toute table exposée ; `docs/decisions.md` mis à jour si décision
  d'archi
