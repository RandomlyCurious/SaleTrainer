/**
 * HARNAIS DE DÉVELOPPEMENT — JETABLE. NE FAIT PAS PARTIE DE L'APP.
 *
 * Sert à juger À L'ŒIL la qualité réelle des personas générés, avant que #12
 * leur donne une voix. Il appelle le VRAI pipeline (#6) et donc la VRAIE API
 * OpenAI : chaque exécution coûte un appel.
 *
 * Volontairement HORS GATES : exclu du typecheck (`tsconfig.json`) et du lint
 * (`eslint.config.mjs`), et exempté de TDD. Ce n'est pas du code de production
 * et il ne doit pas peser sur la CI. Corollaire : il n'est couvert par aucun
 * test — s'il casse, il se jette ou se répare, il ne bloque rien.
 *
 * Usage :
 *   npx tsx scripts/essai-persona.ts \
 *     --offre "maintenance Power BI en abonnement" \
 *     --cible "DAF de PME industrielle" \
 *     --type cold_call --difficulte 2 \
 *     [--linkedin chemin/profil.txt] [--site chemin/site.txt] \
 *     [--contexte chemin/contexte.txt] [--echanges chemin/echanges.txt]
 *
 * Sans --linkedin : mode générique. Avec : mode réel.
 * La clé est lue depuis .env.local (OPENAI_API_KEY).
 */

import { existsSync, readFileSync } from "node:fs";

import { genererPersona } from "@/lib/persona/generation";
import type { EntreesPersona } from "@/lib/persona/prompt";

function chargerEnvLocal(): void {
  if (!existsSync(".env.local")) return;

  for (const ligne of readFileSync(".env.local", "utf8").split("\n")) {
    const nettoyee = ligne.trim();
    if (nettoyee === "" || nettoyee.startsWith("#")) continue;

    const separateur = nettoyee.indexOf("=");
    if (separateur === -1) continue;

    const nom = nettoyee.slice(0, separateur).trim();
    if (process.env[nom] === undefined) {
      process.env[nom] = nettoyee.slice(separateur + 1).trim();
    }
  }
}

function argument(nom: string): string | undefined {
  const index = process.argv.indexOf(`--${nom}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function fichier(nom: string): string | undefined {
  const chemin = argument(nom);
  if (chemin === undefined) return undefined;

  if (!existsSync(chemin)) {
    console.error(`Fichier introuvable pour --${nom} : ${chemin}`);
    process.exit(2);
  }
  return readFileSync(chemin, "utf8");
}

function separateur(titre: string): void {
  console.log(`\n${"─".repeat(60)}\n${titre}\n${"─".repeat(60)}`);
}

async function principal(): Promise<void> {
  chargerEnvLocal();

  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "OPENAI_API_KEY absente. Renseigne-la dans .env.local avant de lancer cet essai.",
    );
    process.exit(1);
  }

  const linkedin = fichier("linkedin");

  const entrees: EntreesPersona = {
    mode: linkedin === undefined ? "generique" : "reel",
    offre: argument("offre") ?? "maintenance Power BI en abonnement pour PME",
    cible: argument("cible") ?? "DAF de PME industrielle de 50 a 200 personnes",
    type_appel: argument("type") === "decouverte" ? "decouverte" : "cold_call",
    difficulte: Number(argument("difficulte") ?? 2) as 1 | 2 | 3,
    texte_linkedin: linkedin,
    texte_site: fichier("site"),
    texte_contexte: fichier("contexte"),
    texte_echanges: fichier("echanges"),
  };

  separateur("ENTRÉES");
  console.log(`mode        : ${entrees.mode}`);
  console.log(`offre       : ${entrees.offre}`);
  console.log(`cible       : ${entrees.cible}`);
  console.log(`type d'appel: ${entrees.type_appel}`);
  console.log(`difficulté  : ${entrees.difficulte}`);
  for (const champ of [
    "texte_linkedin",
    "texte_site",
    "texte_contexte",
    "texte_echanges",
  ] as const) {
    const contenu = entrees[champ];
    console.log(
      `${champ.padEnd(12)}: ${contenu ? `${contenu.length} caractères` : "—"}`,
    );
  }

  const debut = Date.now();
  const resultat = await genererPersona(entrees);
  const duree = ((Date.now() - debut) / 1000).toFixed(1);

  if (!resultat.ok) {
    separateur(`ÉCHEC en ${duree} s`);
    console.error(JSON.stringify(resultat.erreur, null, 2));
    process.exit(1);
  }

  const p = resultat.persona;

  separateur(`PERSONA GÉNÉRÉ en ${duree} s`);
  console.log(`${p.nom_complet} — ${p.role}`);
  console.log(
    `${p.entreprise.nom} (${p.entreprise.secteur}${p.entreprise.taille ? `, ${p.entreprise.taille}` : ""})`,
  );
  console.log(`\nHumeur ${p.humeur.niveau} « ${p.humeur.libelle} »`);
  console.log(`  ${p.humeur.description}`);

  console.log(`\nObjections probables :`);
  for (const objection of p.objections_probables) {
    console.log(`  • ${objection.intitule}`);
    console.log(`      déclenchée : ${objection.declencheur}`);
  }

  console.log(`\nConditions de raccrochage :`);
  for (const condition of p.conditions_raccrochage) {
    console.log(`  • ${condition}`);
  }

  if (p.ancrages.length > 0) {
    console.log(`\nAncrages (à vérifier dans tes textes collés) :`);
    for (const ancrage of p.ancrages) {
      console.log(`  • [${ancrage.source}] ${ancrage.fait}`);
    }
  } else {
    console.log(`\nAncrages : aucun (mode générique)`);
  }

  separateur("JSON BRUT");
  console.log(JSON.stringify(p, null, 2));
}

principal().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
