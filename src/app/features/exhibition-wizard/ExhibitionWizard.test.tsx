import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExhibitionWizard } from "./ExhibitionWizard";

afterEach(() => cleanup());

describe("ExhibitionWizard", () => {
  it("renders a mobile-friendly six-step workflow and reports validation errors", () => {
    render(<ExhibitionWizard />);

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "設定展覽主題" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByRole("alert")).toHaveTextContent("請先輸入展覽主題");
    expect(screen.getByLabelText("展覽主題")).toHaveAttribute("aria-invalid", "true");
  });

  it("moves through built-in fields and render slots using the shared state machine", () => {
    const onDraftChange = vi.fn();

    render(
      <ExhibitionWizard
        onDraftChange={onDraftChange}
        renderUpload={({ patch }) => (
          <button
            type="button"
            onClick={() => patch({
              assets: [{ id: "asset-1", fileName: "art.jpg", status: "succeeded" }],
            })}
          >
            完成上傳
          </button>
        )}
        renderLayout={({ patch }) => (
          <button type="button" onClick={() => patch({ layoutStatus: "complete" })}>
            完成排展
          </button>
        )}
        renderPreview={({ patch }) => (
          <button type="button" onClick={() => patch({ previewReady: true })}>
            完成預覽
          </button>
        )}
        renderPublish={() => <div>發布設定</div>}
      />,
    );

    fireEvent.change(screen.getByLabelText("展覽主題"), {
      target: { value: "六年級成果展" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByRole("heading", { name: "上傳學生作品" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "完成上傳" }));
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    fireEvent.change(screen.getByLabelText("展覽風格"), {
      target: { value: "明亮校園" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    fireEvent.click(screen.getByRole("button", { name: "完成排展" }));
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    fireEvent.click(screen.getByRole("button", { name: "完成預覽" }));
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByText("發布設定")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一步" })).not.toBeInTheDocument();
    expect(onDraftChange).toHaveBeenCalled();
  });
});
