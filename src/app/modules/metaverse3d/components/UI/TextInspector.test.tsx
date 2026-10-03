import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/app/components/I18nProvider";
import { TextInspector } from "./TextInspector";

const mocks = vi.hoisted(() => ({
  loadAuth: vi.fn(),
  polish: vi.fn(),
  translate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({ loadAuth: mocks.loadAuth }));
vi.mock("../../../../api/aiWriting", () => ({
  requestPolishIntro: mocks.polish,
  requestTranslate: mocks.translate,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

function renderInspector(locale = "en") {
  localStorage.setItem("metaexpo-locale", locale);
  const updateItem = vi.fn();
  render(
    <I18nProvider>
      <TextInspector
        selectedItem={{ id: "text-1", type: "text", position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: "Original text" }}
        glassInputClass=""
        updateItem={updateItem}
      />
    </I18nProvider>,
  );
  return updateItem;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.loadAuth.mockReturnValue({ token: "session-token", user: { id: "owner" } });
  mocks.polish.mockResolvedValue({ result: "Polished text" });
  mocks.translate.mockResolvedValue({ result: "Translated text" });
});
afterEach(cleanup);

describe("text inspector AI actions", () => {
  it("previews polished text and only replaces the content after Apply", async () => {
    const updateItem = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Polish", exact: true }));

    expect(await screen.findByText("Polished result")).toBeVisible();
    expect(screen.getByText("Polished text")).toBeVisible();
    expect(updateItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply to text" }));
    expect(updateItem).toHaveBeenCalledWith("text-1", { content: "Polished text" });
    expect(screen.queryByText("Polished result")).not.toBeInTheDocument();
  });

  it("shows a localized translation result and copies it without changing the text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const updateItem = renderInspector("zh-CN");
    fireEvent.click(screen.getByRole("button", { name: "英文", exact: true }));

    expect(await screen.findByText("英文翻译结果")).toBeVisible();
    expect(mocks.translate).toHaveBeenCalledWith("session-token", { text: "Original text", targetLanguage: "en" });
    fireEvent.click(screen.getByRole("button", { name: "复制结果" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Translated text"));
    expect(updateItem).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalled();
  });

  it.each([
    ["zh-TW", "潤飾", "英文"],
    ["zh-CN", "润色", "英文"],
    ["en", "Polish", "English"],
  ])("localizes text actions in %s", (locale, polish, english) => {
    renderInspector(locale);
    expect(screen.getByRole("button", { name: polish, exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: english, exact: true })).toBeVisible();
    if (locale === "en") expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/);
  });

  it("does not send an AI request when the user is signed out", async () => {
    mocks.loadAuth.mockReturnValue({ token: null, user: null });
    renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Polish", exact: true }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.polish).not.toHaveBeenCalled();
  });
});
