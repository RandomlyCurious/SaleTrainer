import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Tests du gate `scripts/scan-secrets.sh` (#21).
 *
 * Le scanner est un contrôle de sécurité qui s'est révélé faux : sa regex
 * attrapait le NOM d'une variable autant qu'un secret. On le teste donc en
 * l'exécutant pour de vrai, contre un dépôt git jetable.
 *
 * TOUS les littéraux sensibles de ce fichier sont ASSEMBLÉS, jamais écrits
 * d'un bloc : un fichier de test de scanner de secrets contient forcément les
 * formes que le scanner cherche, et il se bloquerait lui-même au commit.
 */

const SCANNER = join(process.cwd(), "scripts", "scan-secrets.sh").replace(
  /\\/g,
  "/",
);

const NOM_CLE_ADMIN = "SUPABASE_SERVICE_ROL" + "E_KEY";
const JWT = "ey" + "J" + "hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef";
const CLE_STRIPE_LIVE = "sk_live" + "_" + "51ABCdefGHIjklMNOpqrs";
const JETON_GITHUB = "gh" + "p_" + "ABCdefGHIjklMNOpqrstuvwxyz0123456789";
const CLE_SUPABASE_NOUVEAU_FORMAT = "sb_secret" + "_" + "N7UND0UgjKTVKUodkm0";
const NOM_API_KEY = "API" + "_KEY";
/** Clé publique de la stack Supabase : ce n'est PAS un secret. */
const CLE_PUBLISHABLE = "sb_publishable" + "_" + "ACJWlzQHlZjBrEguHvfOxg";

function git(depot: string, args: string[]): void {
  execFileSync("git", args, { cwd: depot, stdio: "pipe" });
}

/** Code de sortie du scanner sur un dépôt où `ligne` vient d'être ajoutée. */
function codeDeSortie(ligne: string): number {
  const depot = mkdtempSync(join(tmpdir(), "scan-secrets-"));
  try {
    git(depot, ["init", "-q"]);
    git(depot, ["config", "user.email", "test@exemple.test"]);
    git(depot, ["config", "user.name", "test"]);
    git(depot, ["config", "commit.gpgsign", "false"]);

    writeFileSync(join(depot, "socle.txt"), "ligne de base\n");
    git(depot, ["add", "."]);
    git(depot, ["commit", "-q", "-m", "socle"]);

    writeFileSync(join(depot, "ajout.txt"), `${ligne}\n`);
    git(depot, ["add", "."]);

    try {
      execFileSync("sh", [SCANNER, "--cached"], { cwd: depot, stdio: "pipe" });
      return 0;
    } catch (erreur) {
      return (erreur as { status?: number }).status ?? 1;
    }
  } finally {
    rmSync(depot, { recursive: true, force: true });
  }
}

describe("laisse passer ce qui n'est pas un secret", () => {
  it("accepte la lecture du nom de variable depuis le code", () => {
    expect(codeDeSortie(`variableRequise("${NOM_CLE_ADMIN}")`)).toBe(0);
  });

  it("accepte le nom avec une valeur vide, comme dans .env.example", () => {
    expect(codeDeSortie(`${NOM_CLE_ADMIN}=`)).toBe(0);
  });

  it("accepte une affectation depuis une autre variable", () => {
    expect(codeDeSortie(`${NOM_CLE_ADMIN}=$SERVICE_ROLE_KEY`)).toBe(0);
  });

  it("accepte une affectation depuis un secret GitHub Actions", () => {
    expect(codeDeSortie(`${NOM_CLE_ADMIN}: \${{ secrets.CLE }}`)).toBe(0);
  });

  it("accepte le nom cite dans une phrase de documentation", () => {
    expect(
      codeDeSortie(`La ${NOM_CLE_ADMIN} ne doit jamais atteindre le navigateur.`),
    ).toBe(0);
  });

  it("accepte une cle publishable, qui est publique par construction", () => {
    expect(codeDeSortie(`const cle = "${CLE_PUBLISHABLE}";`)).toBe(0);
  });

  // Trouve en ecrivant #21 : la premiere version de l'alternative sb_secret
  // matchait le prefixe nu, et bloquait la ligne de docs/decisions.md qui le
  // cite. Un prefixe cite en prose n'est pas un secret.
  it("accepte le prefixe sb_secret cite en prose, sans cle derriere", () => {
    const prefixe = "sb_secret" + "_";

    expect(codeDeSortie(`Le nouveau format commence par \`${prefixe}…\`.`)).toBe(
      0,
    );
  });
});

describe("bloque les secrets reels", () => {
  it("bloque le nom affecte a une valeur qui ressemble a une cle", () => {
    expect(codeDeSortie(`${NOM_CLE_ADMIN}=${JWT}`)).toBe(1);
  });

  it("bloque le nom affecte a une cle Supabase du nouveau format", () => {
    expect(
      codeDeSortie(`${NOM_CLE_ADMIN}=${CLE_SUPABASE_NOUVEAU_FORMAT}`),
    ).toBe(1);
  });

  it("bloque une cle sb_secret collee nue, sans nom de variable", () => {
    expect(codeDeSortie(`const cle = "${CLE_SUPABASE_NOUVEAU_FORMAT}";`)).toBe(1);
  });

  it("bloque un JWT colle nu, sans nom de variable", () => {
    expect(codeDeSortie(`const jeton = "${JWT}";`)).toBe(1);
  });

  it("bloque une cle Stripe live", () => {
    expect(codeDeSortie(`STRIPE=${CLE_STRIPE_LIVE}`)).toBe(1);
  });

  it("bloque un jeton GitHub", () => {
    expect(codeDeSortie(`token: ${JETON_GITHUB}`)).toBe(1);
  });

  it("bloque une api key en clair, quelle que soit la casse", () => {
    expect(codeDeSortie(`${NOM_API_KEY} = "ABCdefGHIjklMNOpqrstuvwx"`)).toBe(1);
  });
});
