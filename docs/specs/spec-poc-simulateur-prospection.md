# Spec POC — Simulateur vocal d'appels de prospection B2B

## 1. Contexte et objectif

Outil d'entraînement aux appels de prospection et de découverte B2B pour freelances et petits entrepreneurs. L'IA joue le prospect au téléphone (voix, temps réel), l'utilisateur mène l'appel, puis reçoit un debrief scoré.

**Objectif du POC (v0) :** un seul utilisateur (moi), en local ou déployé simplement. Le but est de valider que (a) la simulation vocale est assez réaliste pour créer de l'inconfort utile, (b) le debrief fait progresser. Rien d'autre.

**Différenciateur à valider dès la v0 :** le persona peut être construit à partir d'un VRAI prospect (texte de son profil LinkedIn + texte du site de sa boîte, collés par l'utilisateur). Cas d'usage : « je répète MON appel de demain ».

## 2. Stack imposée

- **Frontend :** Next.js (App Router) + Tailwind. Une seule app.
- **Voix temps réel :** OpenAI Realtime API (speech-to-speech, WebRTC). Pas de pipeline STT→LLM→TTS maison.
- **Backend/DB :** Supabase (auth email simple + Postgres). Pas de RLS multi-tenant en v0, un seul user.
- **LLM debrief :** appel API classique (le modèle disponible le moins cher suffisant) sur le transcript.
- Pas de n8n, pas de WeWeb en v0.

## 3. Parcours utilisateur (3 écrans)

### Écran 1 — Configurer la simulation
Deux modes :

**Mode A — Persona générique.** Formulaire :
- Mon offre (texte libre, ex. « maintenance Power BI en abonnement pour PME »)
- Ma cible (texte libre, ex. « DAF de PME industrielle 50-200 personnes »)
- Type d'appel : cold call / appel de découverte (RDV pris)
- Difficulté : 
  - Niveau 1 « Ouvert » : prospect disponible, objections légères
  - Niveau 2 « Sceptique » : pressé, objections classiques (prix, « envoyez un mail », « on a déjà quelqu'un »)
  - Niveau 3 « Difficile » : coupe la parole, mauvaise foi, peut raccrocher

**Mode B — Vrai prospect (killer feature).** En plus des champs du mode A, quatre zones de collage (toutes optionnelles sauf la première) :
- « Profil LinkedIn du prospect » (copier-coller brut)
- « Site de sa boîte » (page d'accueil / à propos)
- « Mon contexte » : description libre par l'utilisateur (comment il connaît le prospect, l'historique du deal, ce qu'il sait par ailleurs)
- « Échanges précédents » : emails / messages LinkedIn déjà échangés avec ce prospect, collés bruts
- Le système génère un persona calibré : rôle réel, secteur, actualités visibles dans le profil, objections plausibles pour CE contexte. Le persona ne doit JAMAIS prétendre connaître des informations absentes des textes collés.
- Si des échanges précédents sont fournis, l'appel s'inscrit dans leur continuité : le persona SE SOUVIENT de ce qui a été dit/promis et peut s'y référer naturellement (« vous m'aviez parlé de X »), mais ne récite jamais les messages et n'évoque ces éléments que quand c'est naturel dans la conversation. Il peut relever une incohérence entre ce que dit l'utilisateur en appel et ce qu'il avait écrit.

Un bouton « Générer le persona » affiche un résumé (nom fictif ou réel, rôle, humeur, 3 objections probables) que l'utilisateur peut regénérer, puis « Lancer l'appel ».

### Écran 2 — L'appel
- Interface minimale type appel téléphonique : nom du persona, timer, bouton raccrocher, indicateur « il parle / je parle ».
- L'IA décroche et parle en premier (« Allô ? ») en cold call ; en découverte, elle attend que l'utilisateur ouvre.
- Comportements obligatoires du persona : hésitations, interruptions (niveau 2-3), objections placées à des moments non prévisibles, peut raccrocher si l'appel est mauvais (niveau 3) ou si l'utilisateur est hors sujet trop longtemps.
- Durée max : 10 minutes, coupure automatique.
- Tout l'audio est transcrit en continu (le transcript est la matière du debrief).

### Écran 3 — Debrief
Généré automatiquement à la fin de l'appel à partir du transcript :

1. **Score global /10** et score par axe (grille fixe, /10 chacun) :
   - Cadrage : a posé le déroulé et l'objectif de l'appel dans les 60 premières secondes
   - Découverte : ratio questions/affirmations, qualité des questions (ouvertes, sur les enjeux)
   - Écoute : reformulations, rebonds sur ce que dit le prospect vs récitation d'un script
   - Objections : traitées sans paniquer, sans concession immédiate sur le prix
   - Next step : a obtenu un engagement daté et explicite avant de raccrocher
2. **3 moments clés** : citation du transcript + ce qui s'est joué + ce qu'il fallait dire (formulation exacte proposée)
3. **1 consigne pour le prochain appel** (une seule, la plus impactante)
4. Transcript complet consultable, replié par défaut.

Boutons : « Rejouer le même persona » / « Nouvelle simulation ».

### Écran annexe — Historique
Liste des sessions : date, persona, type d'appel, difficulté, score global, lien vers le debrief. Un mini-graphique de l'évolution du score global. Rien de plus.

## 4. Modèle de données (Supabase)

- `personas` : id, mode (generique|reel), offre, cible, type_appel, difficulte, texte_linkedin, texte_site, texte_contexte, texte_echanges, persona_json (le persona généré), created_at
- `sessions` : id, persona_id, transcript_json (tour par tour, horodaté), duree_sec, terminee_par (user|ia_raccroche|timeout), created_at
- `debriefs` : id, session_id, score_global, scores_json (les 5 axes), moments_json, consigne, created_at

## 5. Prompts système (à soigner, c'est le cœur du produit)

**Prompt persona (Realtime).** Doit contenir : identité et contexte du prospect, humeur selon la difficulté, règles de comportement (interrompre, hésiter avec des « euh », phrases courtes et orales, jamais de listes, jamais d'aide à l'utilisateur, jamais sortir du rôle), conditions de raccrochage, et l'interdiction d'inventer des faits sur le prospect réel hors des textes fournis. Si des échanges précédents existent : le persona en connaît le contenu comme un souvenir (pas comme un texte), s'y réfère avec parcimonie et uniquement quand c'est naturel, et peut confronter l'utilisateur à une contradiction avec ses propres écrits. Le prospect parle français courant, registre professionnel oral.

**Prompt debrief.** Reçoit le transcript + le contexte. Applique STRICTEMENT la grille des 5 axes (définitions incluses dans le prompt). Sortie en JSON structuré (scores, moments, consigne). Ton : direct, factuel, pas d'encouragements creux.

## 6. Critères d'acceptation du POC

- Latence de réponse vocale perçue < 1,5 s dans des conditions normales.
- Le persona niveau 2 place au moins 2 objections non annoncées et coupe la parole au moins une fois par appel.
- En mode B, le persona mentionne spontanément au moins 1 élément issu du profil collé, et n'invente aucun fait extérieur.
- Le debrief arrive en < 30 s après la fin de l'appel, avec les 5 scores et la consigne unique.
- Je peux enchaîner 3 simulations sans toucher au code.

## 7. Hors scope v0 (interdit d'y toucher)

Paiement/abonnement, multi-utilisateurs et RLS, scraping automatique de LinkedIn, avatars vidéo, application mobile, parcours gamifié, niveaux à débloquer, dashboard de progression avancé, intégrations CRM, envoi d'emails, landing page marketing.
