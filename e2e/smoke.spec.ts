import { expect, test } from "@playwright/test";

// Test de fumée : prouve que l'app démarre et sert une page.
// À remplacer par les parcours critiques de la première feature.
test("la page d'accueil se charge", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /template prêt/i }),
  ).toBeVisible();
});
