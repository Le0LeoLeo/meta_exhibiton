import { describe, expect, it } from 'vitest';
import { dictionaries, type Locale } from './index';

const locales = Object.keys(dictionaries) as Locale[];
const catalogKeys = [...new Set(locales.flatMap((locale) => Object.keys(dictionaries[locale])))];
const passportExperienceKeys = [
  'passportTitle', 'passportToggleLabel', 'passportProgress', 'passportLoading', 'passportUnavailable', 'passportLoadError',
  'passportRetry', 'passportSignedOut', 'passportSignInPrompt', 'passportSignIn', 'passportTaskVisit', 'passportTaskDwell',
  'passportTaskEngage', 'passportTaskComplete', 'passportTaskIncomplete', 'passportReadyMessage',
  'passportCompleteAction', 'passportViewSouvenir', 'passportCompleteTitle', 'passportCompleteDescription',
  'passportCompletedTitle', 'passportCompletedDescription', 'passportCompletionTitle', 'passportReflectionLabel',
  'passportReflectionPlaceholder', 'passportReflectionHint', 'passportReflectionCount', 'passportPrivateNotice',
  'passportSyncConflict', 'passportCompleteFailed', 'passportPrivateSouvenir', 'passportPrivacyNotice',
  'passportSouvenirTitle', 'passportShareText', 'passportCompleting', 'passportCompleted', 'passportShareAction',
  'passportSharing', 'passportCopyLink', 'passportLinkCopied', 'passportShareCopyFailed', 'passportShareFailed',
  'passportShareUrlLabel', 'passportOpenShareLink', 'passportClose',
  'souvenirLoading', 'souvenirNotFoundTitle', 'souvenirNotFoundDescription', 'souvenirPassportCompleted',
  'souvenirCuratedBy', 'souvenirCompletedOn', 'souvenirVisited', 'souvenirEngaged', 'souvenirDwellTime',
  'souvenirMinutes', 'souvenirFavorite', 'souvenirNoImage', 'souvenirVisitExhibition', 'souvenirExploreMore',
  'souvenirViewCard', 'souvenirRecentLabel', 'souvenirRecentTitle', 'souvenirRecentDescription', 'souvenirRecentEmpty',
] as const;
const artworkDetailKeys = [
  'viewUnsupportedVideo', 'viewUnsupportedFile', 'viewDownloadFile', 'viewUntitled', 'viewUnknownAuthor',
  'viewAuthorLabel', 'viewArtworkCount', 'viewNoDescription', 'viewMoreInfo', 'viewCommentsTitle',
  'viewCommentsCount', 'viewCommentsPrompt', 'viewNicknamePlaceholder', 'viewCommentPlaceholder',
  'viewSubmittingComment', 'viewSubmitComment', 'viewNoComments', 'viewDeleteComment', 'viewDeletingComment',
  'viewDeleteCommentConfirm', 'viewDeleteCommentOnlyAuthor', 'viewCommentNameRequired', 'viewCommentSubmitted',
  'viewCommentSubmitFailed', 'viewCommentDeleted', 'viewCommentDeleteFailed', 'viewCommentDeleteFailedDesc',
  'viewCloseArtwork', 'viewFeedbackLoginRequired', 'viewFeedbackNoComments', 'viewFeedbackSuccess',
  'viewFeedbackFailed', 'viewFeedbackFailedDesc', 'viewFeedbackSummarizing', 'viewFeedbackAISummary',
  'viewFeedbackSummaryTitle',
] as const;
const avatarCustomColorKeys = [
  'avatarCustomTopColorTitle',
  'avatarCustomTopColorDescription',
  'avatarCustomTopColorPicker',
  'avatarCustomTopColorInput',
  'avatarCustomTopColorInvalid',
  'avatarCustomTopColorClear',
] as const;
const registrationSuccessKeys = ['registerSuccess', 'registerSuccessDesc'] as const;
const heroCorePromiseKeys = [
  'heroCoreTitle',
  'heroCoreTitleAccent',
  'heroCoreDescription',
  'heroCoreCta',
] as const;

function resolveMessage(locale: Locale, key: string) {
  return dictionaries[locale][key] ?? dictionaries['zh-TW'][key] ?? key;
}

describe('translation catalogs', () => {
  it('keeps quick exhibition messages and interpolation values in parity', () => {
    const quickExhibitionKeys = catalogKeys.filter((key) => key.startsWith('quickExhibition'));
    expect(quickExhibitionKeys.length).toBeGreaterThan(0);

    for (const key of quickExhibitionKeys) {
      const expectedTokens = dictionaries['zh-TW'][key].match(/\{\w+\}/g)?.sort() ?? [];
      for (const locale of locales) {
        const message = dictionaries[locale][key];
        expect(message, `${locale}.${key}`).toEqual(expect.any(String));
        expect(message.trim(), `${locale}.${key}`).not.toBe('');
        expect(message.match(/\{\w+\}/g)?.sort() ?? [], `${locale}.${key}`).toEqual(expectedTokens);
      }
    }
  });

  it('removes quick upload messages from every locale', () => {
    for (const locale of locales) {
      expect(dictionaries[locale]).not.toHaveProperty('editorQuickUpload');
      expect(Object.keys(dictionaries[locale]).filter((key) => key.startsWith('eup'))).toEqual([]);
    }
  });

  it('keeps the hero core promise in parity', () => {
    for (const locale of locales) {
      for (const key of heroCorePromiseKeys) {
        expect(dictionaries[locale][key], `${locale}.${key}`).toEqual(expect.any(String));
        expect(dictionaries[locale][key].trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the artwork work context guidance in all three languages', () => {
    const keys = catalogKeys.filter((key) => key.startsWith('workContext'));
    expect(keys.length).toBeGreaterThan(0);
    for (const locale of locales) {
      for (const key of keys) {
        expect(dictionaries[locale][key], `${locale}.${key}`).toEqual(expect.any(String));
        expect(dictionaries[locale][key].trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the 3D Agent interface copy in all three languages', () => {
    const keys = catalogKeys.filter((key) => key.startsWith('agentUi.'));
    expect(keys.length).toBeGreaterThan(0);
    for (const locale of locales) {
      for (const key of keys) {
        const message = dictionaries[locale][key];
        expect(message, `${locale}.${key}`).toEqual(expect.any(String));
        expect(message.trim(), `${locale}.${key}`).not.toBe('');
        expect(message.match(/\{\w+\}/g)?.sort() ?? [], `${locale}.${key} interpolation`).toEqual(
          dictionaries['en'][key].match(/\{\w+\}/g)?.sort() ?? [],
        );
      }
    }
  });

  it('keeps registration success messages in parity', () => {
    for (const locale of locales) {
      for (const key of registrationSuccessKeys) {
        expect(dictionaries[locale][key], `${locale}.${key}`).toEqual(expect.any(String));
        expect(dictionaries[locale][key].trim(), `${locale}.${key}`).not.toBe('');
      }

      expect(dictionaries[locale].registerSuccessDesc, `${locale}.registerSuccessDesc`).toContain('{name}');
    }
  });

  it('keeps custom shirt color controls in parity', () => {
    for (const locale of locales) {
      for (const key of avatarCustomColorKeys) {
        expect(dictionaries[locale][key], `${locale}.${key}`).toEqual(expect.any(String));
        expect(dictionaries[locale][key].trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the passport and souvenir experience in parity', () => {
    for (const locale of locales) {
      for (const key of passportExperienceKeys) {
        expect(dictionaries[locale][key], `${locale}.${key}`).toEqual(expect.any(String));
        expect(dictionaries[locale][key].trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('keeps the artwork detail experience in parity', () => {
    for (const locale of locales) {
      for (const key of artworkDetailKeys) {
        expect(dictionaries[locale][key], `${locale}.${key}`).toEqual(expect.any(String));
        expect(dictionaries[locale][key].trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('resolves every catalog key through the locale, zh-TW, and key fallback chain', () => {
    for (const locale of locales) {
      for (const key of catalogKeys) {
        expect(resolveMessage(locale, key), `${locale}.${key}`).toEqual(expect.any(String));
      }
    }
  });

  it('preserves fallback behavior for locale-specific and unknown keys', () => {
    expect(resolveMessage('zh-CN', 'clearSearch')).toBe(dictionaries['zh-TW'].clearSearch);
    expect(resolveMessage('zh-TW', 'viewArtworkCount')).toBe('作品 {current} / {total}');
    expect(resolveMessage('en', 'unknownTranslationKey')).toBe('unknownTranslationKey');
  });

  it('preserves the existing empty English no-match suffix', () => {
    expect(dictionaries.en.supportNoMatchSuffix).toBe('');
  });
});
