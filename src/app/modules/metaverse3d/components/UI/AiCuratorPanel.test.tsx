import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CuratorPlanResponse } from "@/app/api/aiCurator";
import { AiCuratorPanel } from "./AiCuratorPanel";

const plan: CuratorPlanResponse = {
  source: "fallback",
  exhibition: {
    title: "澳門非遺文化展",
    introduction: "以手藝、節慶與街區記憶構成的展覽。",
    guideOpening: "歡迎來到澳門非遺文化展。",
    sections: [
      { id: "section-01", title: "手藝", summary: "看見工藝與城市記憶。" },
    ],
    exhibits: [
      {
        id: "exhibit-01",
        sectionId: "section-01",
        title: "木雕招牌",
        description: "街角招牌。",
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
  it("generates a preview and applies only after inline confirmation", async () => {
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

    fireEvent.change(screen.getByLabelText("展覽主題"), {
      target: { value: "澳門非遺文化展" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成策展方案" }));

    await screen.findByText("澳門非遺文化展");
    expect(importScene).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "套用到展廳" }));
    expect(importScene).not.toHaveBeenCalled();
    expect(screen.getByText("即將取代目前展廳草稿")).toBeInTheDocument();
    expect(screen.getByText("1 個展區 / 1 件展品")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "確認套用" }));
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

    fireEvent.change(screen.getByLabelText("展覽主題"), {
      target: { value: "澳門非遺文化展" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成策展方案" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network failed"));
    expect(importScene).not.toHaveBeenCalled();
  });
});
