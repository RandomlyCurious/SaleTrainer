-- Migration 001 — schéma du POC simulateur + RLS mono-utilisateur.
--
-- Ticket #2. Une fois appliquée, cette migration ne se réédite JAMAIS :
-- tout changement de schéma passe par un nouveau fichier (règle CLAUDE.md).
--
-- RLS : activée sur les trois tables, policies `auth.uid() = user_id`.
-- Le hors-scope « multi-utilisateurs » de la spec vise les FONCTIONNALITÉS
-- (partage, rôles, invitations), pas le verrou par défaut — décision du
-- 2026-08-07 dans docs/decisions.md.
--
-- `user_id` est dénormalisé sur `sessions` et `debriefs` : une policy qui
-- joint la table parente est plus lente et casse au premier changement de
-- schéma. Contrepartie : la cohérence parent/enfant est garantie côté code
-- (ticket #7).

-- ---------------------------------------------------------------------------
-- personas
-- ---------------------------------------------------------------------------
create table public.personas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  mode            text not null check (mode in ('generique', 'reel')),
  offre           text not null,
  cible           text not null,
  type_appel      text not null check (type_appel in ('cold_call', 'decouverte')),
  difficulte      smallint not null check (difficulte in (1, 2, 3)),
  texte_linkedin  text,
  texte_site      text,
  texte_contexte  text,
  texte_echanges  text,
  persona_json    jsonb not null,
  created_at      timestamptz not null default now()
);

create index personas_user_id_created_at_idx
  on public.personas (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
-- `duree_sec` et `terminee_par` restent nuls tant que l'appel est en cours.
create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  persona_id      uuid not null references public.personas (id) on delete cascade,
  transcript_json jsonb not null default '[]'::jsonb,
  duree_sec       integer check (duree_sec >= 0),
  terminee_par    text check (terminee_par in ('user', 'ia_raccroche', 'timeout')),
  created_at      timestamptz not null default now()
);

create index sessions_user_id_created_at_idx
  on public.sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- debriefs
-- ---------------------------------------------------------------------------
-- `score_global` duplique `scores_json.global` : colonne pour le tri et le
-- graphique de l'historique, JSON pour le contrat. L'invariant d'égalité est
-- garanti côté code et testé (ticket #10).
create table public.debriefs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- `unique` : une session ne porte qu'un seul debrief. Sans lui, un rejeu de
  -- la génération (#10) empilerait des debriefs concurrents sur le même appel,
  -- et l'historique n'aurait plus de score unique à afficher.
  session_id   uuid not null unique references public.sessions (id) on delete cascade,
  score_global smallint not null check (score_global between 0 and 10),
  scores_json  jsonb not null,
  moments_json jsonb not null,
  consigne     text not null,
  created_at   timestamptz not null default now()
);

create index debriefs_user_id_created_at_idx
  on public.debriefs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Privilèges
-- ---------------------------------------------------------------------------
-- La RLS filtre les LIGNES, elle ne donne pas accès à la TABLE : sans GRANT,
-- tout se solde par « permission denied » et les policies ne sont même pas
-- évaluées. Les tables créées par migration n'héritent d'aucun privilège.
--
-- `authenticated` reçoit les quatre verbes, bornés ensuite par les policies.
-- `anon` ne reçoit que `select` : il n'a aucune raison légitime d'écrire, et
-- la RLS lui renverra de toute façon zéro ligne. Une tentative d'écriture
-- anonyme échoue donc au privilège, avant même la policy.
grant select, insert, update, delete on public.personas to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.debriefs to authenticated;

grant select on public.personas to anon;
grant select on public.sessions to anon;
grant select on public.debriefs to anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Sans policy, RLS activée = table fermée. Chaque table en reçoit quatre, une
-- par verbe, toutes sur `auth.uid() = user_id`. Un client anon a `auth.uid()`
-- nul : il ne lit rien et n'écrit rien.

alter table public.personas enable row level security;
alter table public.sessions enable row level security;
alter table public.debriefs enable row level security;

-- personas
create policy "personas_select_proprietaire" on public.personas
  for select using (auth.uid() = user_id);
create policy "personas_insert_proprietaire" on public.personas
  for insert with check (auth.uid() = user_id);
create policy "personas_update_proprietaire" on public.personas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "personas_delete_proprietaire" on public.personas
  for delete using (auth.uid() = user_id);

-- sessions
create policy "sessions_select_proprietaire" on public.sessions
  for select using (auth.uid() = user_id);
create policy "sessions_insert_proprietaire" on public.sessions
  for insert with check (auth.uid() = user_id);
create policy "sessions_update_proprietaire" on public.sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_delete_proprietaire" on public.sessions
  for delete using (auth.uid() = user_id);

-- debriefs
create policy "debriefs_select_proprietaire" on public.debriefs
  for select using (auth.uid() = user_id);
create policy "debriefs_insert_proprietaire" on public.debriefs
  for insert with check (auth.uid() = user_id);
create policy "debriefs_update_proprietaire" on public.debriefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "debriefs_delete_proprietaire" on public.debriefs
  for delete using (auth.uid() = user_id);
