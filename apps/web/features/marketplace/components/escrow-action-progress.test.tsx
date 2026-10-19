/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { EscrowActionProgress } from "./escrow-action-progress";

describe("EscrowActionProgress", () => {
  it("announces phase updates politely with the shared spinner", () => {
    render(<EscrowActionProgress progress="awaiting_signature" />);

    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("status").textContent).toContain("Waiting for your wallet signature");
    expect(
      screen
        .getByRole("status")
        .querySelector("svg")
        ?.classList.contains("motion-reduce:animate-none"),
    ).toBe(true);
  });

  it("renders no status region after the action ends", () => {
    const { container } = render(<EscrowActionProgress progress={null} />);

    expect(container.firstChild).toBeNull();
  });
});
