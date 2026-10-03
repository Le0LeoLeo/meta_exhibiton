import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "./I18nProvider";

const requiredTraditionalKeys = [
  "supportClearSearch",
  "supportContactDesc",
  "supportContactEmail",
  "supportContactEmailAction",
  "supportContactEmailAvail",
  "supportContactEmailDesc",
  "supportContactLiveChat",
  "supportContactLiveChatAction",
  "supportContactLiveChatAvail",
  "supportContactLiveChatDesc",
  "supportContactPhone",
  "supportContactPhoneAction",
  "supportContactPhoneAvail",
  "supportContactPhoneDesc",
  "supportContactSection",
  "supportContactTitle",
  "supportErrDescRequired",
  "supportErrEmailInvalid",
  "supportErrEmailRequired",
  "supportErrNameRequired",
  "supportErrSubjectRequired",
  "supportFaq1A",
  "supportFaq1Q",
  "supportFaq2A",
  "supportFaq2Q",
  "supportFaq3A",
  "supportFaq3Q",
  "supportFaq4A",
  "supportFaq4Q",
  "supportFaq5A",
  "supportFaq5Q",
  "supportFaq6A",
  "supportFaq6Q",
  "supportFaq7A",
  "supportFaq7Q",
  "supportFaqNoSearch",
  "supportFaqSearchResult",
  "supportFaqSection",
  "supportFaqTitle",
  "supportFormDescLabel",
  "supportFormDescPlaceholder",
  "supportFormEmailLabel",
  "supportFormEmailPlaceholder",
  "supportFormNameLabel",
  "supportFormNamePlaceholder",
  "supportFormSubjectLabel",
  "supportFormSubjectPlaceholder",
  "supportFormSubmit",
  "supportFormSubmitting",
  "supportQuickForum",
  "supportQuickGuide",
  "supportQuickManual",
  "supportQuickVideo",
  "supportRequestDesc",
  "supportRequestSection",
  "supportRequestTitle",
  "supportToastChatOnline",
  "supportToastChatOnlineDesc",
  "supportToastEmailOpen",
  "supportToastEmailOpenDesc",
  "supportToastForumDesc",
  "supportToastPhoneInfoDesc",
  "supportToastSubmitted",
  "supportToastSubmittedDesc",
  "viewExit",
  "namePlaceholder",
  "confirmPasswordPlaceholder",
  "orSocialRegister",
  "googleRegister",
  "googleRegisterDesc",
  "githubRegister",
  "githubRegisterDesc",
  "termsDesc",
  "privacyPolicyDesc",
  "registerFailedDesc",
  "registerSuccessDesc",
  "cannotUndo",
  "close",
  "confirmDelete",
  "confirmPublish",
  "copiedEditShareLink",
  "copiedViewShareLink",
  "copyEditShareLink",
  "copyViewShareLink",
  "createAndEdit",
  "creating",
  "deleteExhibition",
  "deleteExhibitionConfirm",
  "enterExhibitionDescription",
  "enterExhibitionName",
  "exhibitionDescription",
  "exhibitionName",
  "lastUpdated",
  "noDescriptionYet",
  "publishExhibition",
  "publishExhibitionDesc",
  "publishInfo",
  "publishNotice",
  "publishing",
  "saveInfo",
  "selectTemplate",
  "shareExhibition",
  "shareExhibitionDesc",
  "thisExhibition",
  "toBePublished",
  "untitledExhibition",
] as const;

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <p>{locale}</p>
      <p>{t("editorAiBuilderPreviewTitle")}</p>
      <button type="button" onClick={() => setLocale(locale === "en" ? "zh-TW" : "en")}>
        switch
      </button>
    </div>
  );
}

function TranslationProbe({ keys }: { keys: readonly string[] }) {
  const { t } = useI18n();

  return (
    <ul>
      {keys.map((key) => (
        <li key={key} data-testid={`translation-${key}`}>{t(key)}</li>
      ))}
    </ul>
  );
}

describe("I18nProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("continues rendering when locale storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("en")).toBeInTheDocument();
    expect(screen.getByText("Generated preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByText("zh-TW")).toBeInTheDocument();
    expect(screen.getByText("預覽生成結果")).toBeInTheDocument();
  });

  it("provides Traditional Chinese translations for support and register pages", () => {
    window.localStorage.setItem("metaexpo-locale", "zh-TW");

    render(
      <I18nProvider>
        <TranslationProbe keys={requiredTraditionalKeys} />
      </I18nProvider>,
    );

    for (const key of requiredTraditionalKeys) {
      expect(screen.getByTestId(`translation-${key}`)).not.toHaveTextContent(key);
    }
  });
});
