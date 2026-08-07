import { afterEach, describe, expect, it } from "vitest";

import { readPublicSupabaseEnv } from "@/lib/supabase/env";

const initialUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const initialKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function restore(name: string, valeur: string | undefined) {
  if (valeur === undefined) delete process.env[name];
  else process.env[name] = valeur;
}

afterEach(() => {
  restore("NEXT_PUBLIC_SUPABASE_URL", initialUrl);
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY", initialKey);
});

describe("lecture de l'environnement Supabase public", () => {
  it("renvoie null sans lever quand les deux variables sont absentes", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(readPublicSupabaseEnv()).toBeNull();
  });

  it("renvoie null quand une seule des deux variables est presente", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemple.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(readPublicSupabaseEnv()).toBeNull();
  });

  it("renvoie null quand une variable est blanche", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "  ";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "cle-anon-de-test";

    expect(readPublicSupabaseEnv()).toBeNull();
  });

  it("renvoie l'url et la cle anon quand les deux sont presentes", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemple.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "cle-anon-de-test";

    expect(readPublicSupabaseEnv()).toEqual({
      url: "https://exemple.supabase.co",
      anonKey: "cle-anon-de-test",
    });
  });
});
