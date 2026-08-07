import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  clientAnon,
  creerUtilisateurDeTest,
  personaDeTest,
  supprimerUtilisateurDeTest,
  type UtilisateurDeTest,
} from "../helpers/supabase";

/**
 * Tests d'intégration de la migration 001 (#2).
 *
 * Ils visent la stack Supabase locale : une policy ne se prouve pas autrement
 * que contre un vrai Postgres. Prérequis : `npx supabase start`.
 */

let alice: UtilisateurDeTest;
let bob: UtilisateurDeTest;
let personaDAlice: string;
let sessionDAlice: string;

beforeAll(async () => {
  alice = await creerUtilisateurDeTest("alice");
  bob = await creerUtilisateurDeTest("bob");

  const persona = await alice.client
    .from("personas")
    .insert(personaDeTest(alice.id))
    .select("id")
    .single();
  if (persona.error !== null) throw new Error(persona.error.message);
  personaDAlice = persona.data.id;

  const session = await alice.client
    .from("sessions")
    .insert({ user_id: alice.id, persona_id: personaDAlice })
    .select("id")
    .single();
  if (session.error !== null) throw new Error(session.error.message);
  sessionDAlice = session.data.id;

  const debrief = await alice.client.from("debriefs").insert({
    user_id: alice.id,
    session_id: sessionDAlice,
    score_global: 7,
    scores_json: { global: 7 },
    moments_json: [],
    consigne: "Poser le cadre dans les 60 premieres secondes.",
  });
  if (debrief.error !== null) throw new Error(debrief.error.message);
}, 60_000);

afterAll(async () => {
  await supprimerUtilisateurDeTest(alice.id);
  await supprimerUtilisateurDeTest(bob.id);
}, 60_000);

describe("RLS — client anonyme", () => {
  it("ne lit aucune ligne des trois tables", async () => {
    const anon = clientAnon();

    for (const table of ["personas", "sessions", "debriefs"]) {
      const { data, error } = await anon.from(table).select("id");

      expect(error, `lecture anon sur ${table}`).toBeNull();
      expect(data, `lecture anon sur ${table}`).toEqual([]);
    }
  });

  it("ne peut inserer dans aucune des trois tables", async () => {
    const anon = clientAnon();

    const persona = await anon.from("personas").insert(personaDeTest(alice.id));
    expect(persona.error).not.toBeNull();

    const session = await anon
      .from("sessions")
      .insert({ user_id: alice.id, persona_id: personaDAlice });
    expect(session.error).not.toBeNull();

    const debrief = await anon.from("debriefs").insert({
      user_id: alice.id,
      session_id: sessionDAlice,
      score_global: 5,
      scores_json: { global: 5 },
      moments_json: [],
      consigne: "test",
    });
    expect(debrief.error).not.toBeNull();
  });
});

describe("RLS — isolation entre utilisateurs", () => {
  it("Bob ne voit aucune ligne d'Alice", async () => {
    for (const table of ["personas", "sessions", "debriefs"]) {
      const { data, error } = await bob.client.from(table).select("id");

      expect(error, `lecture de Bob sur ${table}`).toBeNull();
      expect(data, `lecture de Bob sur ${table}`).toEqual([]);
    }
  });

  it("Alice voit bien ses propres lignes", async () => {
    const { data, error } = await alice.client.from("personas").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("Bob ne peut pas modifier le persona d'Alice", async () => {
    const { data, error } = await bob.client
      .from("personas")
      .update({ offre: "detournee" })
      .eq("id", personaDAlice)
      .select("id");

    // La policy filtre la ligne : aucune erreur, mais rien n'est modifie.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const relecture = await alice.client
      .from("personas")
      .select("offre")
      .eq("id", personaDAlice)
      .single();
    expect(relecture.data?.offre).toBe(personaDeTest(alice.id).offre);
  });

  it("Bob ne peut pas supprimer le persona d'Alice", async () => {
    const { error } = await bob.client
      .from("personas")
      .delete()
      .eq("id", personaDAlice);
    expect(error).toBeNull();

    const restant = await alice.client.from("personas").select("id");
    expect(restant.data).toHaveLength(1);
  });

  it("Bob ne peut pas inserer une ligne au nom d'Alice", async () => {
    const { error } = await bob.client
      .from("personas")
      .insert(personaDeTest(alice.id));

    expect(error).not.toBeNull();
  });
});

describe("Contraintes CHECK", () => {
  it("rejette un mode hors enumeration", async () => {
    const { error } = await alice.client
      .from("personas")
      .insert({ ...personaDeTest(alice.id), mode: "hybride" });

    expect(error).not.toBeNull();
  });

  it("rejette un type_appel hors enumeration", async () => {
    const { error } = await alice.client
      .from("personas")
      .insert({ ...personaDeTest(alice.id), type_appel: "visio" });

    expect(error).not.toBeNull();
  });

  it("rejette une difficulte hors 1-3", async () => {
    const { error } = await alice.client
      .from("personas")
      .insert({ ...personaDeTest(alice.id), difficulte: 4 });

    expect(error).not.toBeNull();
  });

  it("rejette un terminee_par hors enumeration", async () => {
    const { error } = await alice.client.from("sessions").insert({
      user_id: alice.id,
      persona_id: personaDAlice,
      terminee_par: "coupure_reseau",
    });

    expect(error).not.toBeNull();
  });

  it("rejette un score_global hors 0-10", async () => {
    const { error } = await alice.client.from("debriefs").insert({
      user_id: alice.id,
      session_id: sessionDAlice,
      score_global: 11,
      scores_json: { global: 11 },
      moments_json: [],
      consigne: "test",
    });

    expect(error).not.toBeNull();
  });
});
