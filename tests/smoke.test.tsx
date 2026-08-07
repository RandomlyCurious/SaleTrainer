import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

// Test de fumée : prouve que la chaîne Vitest + jsdom + React fonctionne.
// À supprimer dès que la première vraie feature a ses tests.
describe("page d'accueil", () => {
  it("affiche le titre du template", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /template prêt/i }),
    ).toBeInTheDocument();
  });
});
