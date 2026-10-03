import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaintingInspector } from "./PaintingInspector";
import { I18nProvider } from '@/app/components/I18nProvider';

const mocks = vi.hoisted(() => ({
  loadAuth: vi.fn(),
  polish: vi.fn(),
  translate: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({ loadAuth: mocks.loadAuth }));
vi.mock("../../../../api/aiWriting", () => ({
  requestPolishIntro: mocks.polish,
  requestTranslate: mocks.translate,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));

function renderInspector() {
  const updateItem = vi.fn();
  render(<I18nProvider><PaintingInspector
    selectedItem={{ id: "painting-1", type: "painting", position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: "", description: "Original description" }}
    glassInputClass="" glassButtonClass=""
    keepFrameAspectRatio={false} setKeepFrameAspectRatio={vi.fn()}
    maxPaintingUploadSizeMB={10} selectedItemIsVideo={false}
    updateItem={updateItem} setAllPaintingFrameSize={vi.fn()}
    setAllPaintingFrameAppearance={vi.fn()}
    isTtsGenerating={false} isTtsSpeaking={false} ttsError={null}
    playGuideAudio={vi.fn()} stopGuideAudio={vi.fn()}
  /></I18nProvider>);
  return updateItem;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.loadAuth.mockReturnValue({ token: "session-token", user: { id: "owner" } });
  mocks.polish.mockResolvedValue({ result: "Polished description" });
  mocks.translate.mockResolvedValue({ result: "Translation" });
});
afterEach(cleanup);

describe("painting description AI actions", () => {
  it("passes the session token and applies the polished description", async () => {
    const updateItem = renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Polish", exact: true }));
    await waitFor(() => expect(updateItem).toHaveBeenCalledWith("painting-1", { description: "Polished description" }));
    expect(mocks.polish).toHaveBeenCalledWith("session-token", { text: "Original description" });
  });

  it.each([["EN", "English"], ["PT", "Portuguese"]])("passes the token for %s translation", async (button, language) => {
    renderInspector();
    fireEvent.click(screen.getByRole("button", { name: button, exact: true }));
    await waitFor(() => expect(mocks.translate).toHaveBeenCalledWith("session-token", { text: "Original description", targetLanguage: language }));
  });

  it("requests sign-in before sending an unauthenticated AI request", async () => {
    mocks.loadAuth.mockReturnValue({ token: null, user: null });
    renderInspector();
    fireEvent.click(screen.getByRole("button", { name: "Polish", exact: true }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.polish).not.toHaveBeenCalled();
  });
});

it.each([
  ['en', 'Artwork title', 'Artist', 'Classic gold', 'Polish'],
  ['zh-CN', '作品标题', '作者', '经典金框', '润色'],
  ['zh-TW', '作品標題', '作者', '經典金框', '潤飾'],
])('localizes editing controls and preserves edits in %s', (locale, title, artist, preset, polish) => {
  localStorage.setItem('metaexpo-locale', locale);
  const updateItem = renderInspector();
  fireEvent.change(screen.getByRole('textbox', { name: title, exact: true }), { target: { value: 'New title' } });
  expect(updateItem).toHaveBeenCalledWith('painting-1', { title: 'New title' });
  expect(screen.getByRole('textbox', { name: artist, exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(preset) }));
  expect(updateItem).toHaveBeenCalledWith('painting-1', expect.objectContaining({ frameStyle: 'classic' }));
  expect(screen.getByRole('button', { name: polish, exact: true })).toBeVisible();
  if (locale === 'en') expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/);
});

it('keeps incomplete source entries local and saves only validated public sources', () => {
  const updateItem = renderInspector();
  expect(screen.getByText('This is public exhibition content. Do not include private or identifying information.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Source 1 name' }), { target: { value: 'Museum archive' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Source 1 link (optional)' }), { target: { value: 'https:example.org/archive' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save sources' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Links must be complete http or https addresses.');
  expect(updateItem).not.toHaveBeenCalledWith('painting-1', expect.objectContaining({ workContext: expect.anything() }));

  fireEvent.change(screen.getByRole('textbox', { name: 'Source 1 link (optional)' }), { target: { value: 'https://example.org/archive' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save sources' }));
  expect(updateItem).toHaveBeenCalledWith('painting-1', {
    workContext: { sources: [{ label: 'Museum archive', url: 'https://example.org/archive' }] },
  });
});
