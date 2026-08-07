import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Charge .env.local dans l'environnement des tests.
 *
 * Les tests d'intégration (#2) visent la stack Supabase locale ; leurs URL et
 * clés vivent dans .env.local, jamais dans le dépôt. `vitest/config` n'expose
 * pas `loadEnv`, et importer depuis `vite` reviendrait à dépendre d'un paquet
 * transitif non déclaré — d'où cette lecture explicite.
 *
 * En CI il n'y a pas de .env.local : les valeurs viennent de l'environnement
 * du job, que Vitest hérite déjà.
 */
function chargerEnvLocal(): Record<string, string> {
  const chemin = fileURLToPath(new URL("./.env.local", import.meta.url));
  if (!existsSync(chemin)) return {};

  const variables: Record<string, string> = {};
  for (const ligne of readFileSync(chemin, "utf8").split("\n")) {
    const nettoyee = ligne.trim();
    if (nettoyee === "" || nettoyee.startsWith("#")) continue;

    const separateur = nettoyee.indexOf("=");
    if (separateur === -1) continue;

    variables[nettoyee.slice(0, separateur).trim()] = nettoyee
      .slice(separateur + 1)
      .trim();
  }
  return variables;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    env: chargerEnvLocal(),
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    // Les e2e sont pilotés par Playwright, pas par Vitest.
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**"],
      // Seuils gelés à 0 pour toute la v0 : la montée à 80/80 est conditionnée
      // au GO de #16 (exception POC de CLAUDE.md, voir docs/decisions.md).
      thresholds: {
        lines: 0,
        functions: 0,
      },
    },
  },
});
