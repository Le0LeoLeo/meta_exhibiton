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

function resolveMessage(locale: Locale, key: string) {
  return dictionaries[locale][key] ?? dictionaries['zh-TW'][key] ?? key;
}

describe('translation catalogs', () => {
  it('keeps the passport and souvenir experience in parity', () => {
    for (const locale of locales) {
      for (const key of passportExperienceKeys) {
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
    expect(resolveMessage('zh-TW', 'viewArtworkCount')).toBe('viewArtworkCount');
    expect(resolveMessage('en', 'unknownTranslationKey')).toBe('unknownTranslationKey');
  });

  it('preserves the existing empty English no-match suffix', () => {
    expect(dictionaries.en.supportNoMatchSuffix).toBe('');
  });
});
