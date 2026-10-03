import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { I18nProvider, useI18n, type Locale } from "@/app/components/I18nProvider";
import { dictionaries } from "@/app/i18n/catalogs";

import { ExhibitionWizard } from "./ExhibitionWizard";
import { createExhibitionWizardDraft, type ExhibitionWizardStep } from "./wizardStore";

afterEach(() => { cleanup(); localStorage.clear(); });

function LocaleControls() {
  const { setLocale } = useI18n();
  return <>{(['en', 'zh-TW', 'zh-CN'] as const).map((locale) => <button key={locale} onClick={() => setLocale(locale)}>{locale}</button>)}</>;
}

function renderWizard(element: ReactNode, locale: Locale = 'zh-TW') {
  localStorage.setItem('metaexpo-locale', locale);
  return render(<I18nProvider><LocaleControls />{element}</I18nProvider>);
}

describe("ExhibitionWizard", () => {
  it("renders a mobile-friendly six-step workflow and reports validation errors", () => {
    renderWizard(<ExhibitionWizard />);

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "設定展覽主題" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByRole("alert")).toHaveTextContent("請先輸入展覽主題");
    expect(screen.getByLabelText("展覽主題")).toHaveAttribute("aria-invalid", "true");
  });

  it("moves through built-in fields and render slots using the shared state machine", () => {
    const onDraftChange = vi.fn();

    renderWizard(
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

  const localizedCopy = [
    { locale: 'en', title: 'Set the exhibition theme', theme: 'Exhibition theme', next: 'Next', error: 'Enter an exhibition theme first.', progress: 'Exhibition progress: step 1 of 6', style: 'Exhibition style' },
    { locale: 'zh-TW', title: '設定展覽主題', theme: '展覽主題', next: '下一步', error: '請先輸入展覽主題', progress: '建展進度：第 1 步，共 6 步', style: '展覽風格' },
    { locale: 'zh-CN', title: '设置展览主题', theme: '展览主题', next: '下一步', error: '请先输入展览主题', progress: '建展进度：第 1 步，共 6 步', style: '展览风格' },
  ] as const;

  it.each(localizedCopy)('renders translated fields, accessible progress and validation in $locale', (copy) => {
    renderWizard(<ExhibitionWizard />, copy.locale);
    expect(screen.getByRole('heading', { name: copy.title })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: copy.progress })).toBeInTheDocument();
    expect(screen.getByLabelText(copy.theme)).toHaveAttribute('aria-invalid', 'false');
    fireEvent.click(screen.getByRole('button', { name: copy.next }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.error);
    expect(screen.getByLabelText(copy.theme)).toHaveAttribute('aria-invalid', 'true');
  });

  it('changes the language of an existing error without resetting the draft or step', () => {
    const onDraftChange = vi.fn();
    renderWizard(<ExhibitionWizard onDraftChange={onDraftChange} />, 'en');
    fireEvent.change(screen.getByLabelText('Exhibition theme'), { target: { value: 'My student exhibition' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Finish uploading at least one artwork first.');
    const changesBeforeLocale = onDraftChange.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'zh-CN' }));
    expect(screen.getByRole('heading', { name: '上传学生作品' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('请先完成至少一件作品的上传');
    fireEvent.click(screen.getByRole('button', { name: 'zh-TW' }));
    expect(screen.getByRole('alert')).toHaveTextContent('請先完成至少一件作品的上傳');
    expect(onDraftChange).toHaveBeenCalledTimes(changesBeforeLocale);
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByLabelText('展覽主題')).toHaveValue('My student exhibition');
  });

  it.each(['en', 'zh-TW', 'zh-CN'] as const)('translates all step titles, slot fallbacks and prerequisite errors in %s', (locale) => {
    const dictionary = dictionaries[locale];
    const steps = [
      ['upload', 'wizard.uploadTitle', 'wizard.uploadUnavailable', 'wizard.errorUploadRequired'],
      ['style', 'wizard.styleTitle', null, 'wizard.errorStyleRequired'],
      ['layout', 'wizard.layoutTitle', 'wizard.layoutUnavailable', 'wizard.errorLayoutRequired'],
      ['preview', 'wizard.previewTitle', 'wizard.previewUnavailable', 'wizard.errorPreviewRequired'],
      ['publish', 'wizard.publishTitle', 'wizard.publishUnavailable', null],
    ] as const;
    for (const [step, title, fallback, error] of steps) {
      const initialDraft = { ...createExhibitionWizardDraft(), currentStep: step as ExhibitionWizardStep, furthestStep: step as ExhibitionWizardStep };
      const view = renderWizard(<ExhibitionWizard initialDraft={initialDraft} />, locale);
      expect(screen.getByRole('heading', { name: dictionary[title] })).toBeInTheDocument();
      if (fallback) expect(screen.getByText(dictionary[fallback])).toBeInTheDocument();
      if (step === 'style') expect(screen.getByLabelText(dictionary['wizard.styleLabel'])).toHaveAttribute('placeholder', dictionary['wizard.stylePlaceholder']);
      if (error) {
        fireEvent.click(screen.getByRole('button', { name: dictionary['wizard.next'] }));
        expect(screen.getByRole('alert')).toHaveTextContent(dictionary[error]);
      }
      view.unmount();
    }
  });

  it('provides all wizard messages and matching interpolation fields in every locale', () => {
    const keys = Object.keys(dictionaries.en).filter((key) => key.startsWith('wizard.'));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      for (const locale of ['en', 'zh-TW', 'zh-CN'] as const) {
        const message = dictionaries[locale][key];
        expect(message, `${locale}.${key}`).toBeTypeOf('string');
        expect(message.trim(), `${locale}.${key}`).not.toBe('');
        expect(message.match(/\{\w+\}/g)?.sort() ?? [], `${locale}.${key}`).toEqual(dictionaries.en[key].match(/\{\w+\}/g)?.sort() ?? []);
      }
    }
  });
});
