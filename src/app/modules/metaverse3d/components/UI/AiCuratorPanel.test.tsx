import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CuratorPlanResponse } from "@/app/api/aiCurator";
import { AiCuratorPanel } from "./AiCuratorPanel";

const plan: CuratorPlanResponse = {
  source: "fallback",
  exhibition: {
    title: "Macau heritage exhibition",
    introduction: "A short introduction for the generated exhibition.",
    guideOpening: "Welcome to the Macau heritage exhibition.",
    sections: [
      { id: "section-01", title: "Origins", summary: "Early story and context." },
    ],
    exhibits: [
      {
        id: "exhibit-01",
        sectionId: "section-01",
        title: "First artifact",
        description: "A representative artifact.",
        medium: "text",
        placementHint: "left-wall",
      },
    ],
  },
  warnings: [],
};

afterEach(() => {
  cleanup();
});

describe("AiCuratorPanel", () => {
  it("generates a preview and applies only after confirmation", async () => {
    const requestCuratorPlan = vi.fn().mockResolvedValue(plan);
    const importScene = vi.fn();
    const onApplied = vi.fn();

    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={null}
        importScene={importScene}
        onApplied={onApplied}
        requestCuratorPlan={requestCuratorPlan}
      />,
    );

    fireEvent.change(screen.getByLabelText("Exhibition theme"), {
      target: { value: "Macau heritage exhibition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate curator plan" }));

    await screen.findByText("Macau heritage exhibition");
    expect(importScene).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply to scene" }));
    expect(importScene).toHaveBeenCalledTimes(1);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("shows an error without applying a scene", async () => {
    const requestCuratorPlan = vi.fn().mockRejectedValue(new Error("network failed"));
    const importScene = vi.fn();

    render(
      <AiCuratorPanel
        token="token-1"
        currentScene={null}
        importScene={importScene}
        requestCuratorPlan={requestCuratorPlan}
      />,
    );

    fireEvent.change(screen.getByLabelText("Exhibition theme"), {
      target: { value: "Macau heritage exhibition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate curator plan" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network failed"));
    expect(importScene).not.toHaveBeenCalled();
  });
});
