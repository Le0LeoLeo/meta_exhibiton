import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { useI18n } from './I18nProvider';

const messages = {
  en: 'You have unsaved changes or an operation in progress. Leave and discard any unsaved changes?',
  'zh-TW': '你有尚未儲存的修改或正在進行的操作。確定離開並放棄未儲存的修改？',
  'zh-CN': '你有尚未保存的修改或正在进行的操作。确定离开并放弃未保存的修改？',
};

type GuardContext = {
  guards: Map<symbol, boolean>;
  confirmDiscard: (action: () => void) => boolean;
};
const Context = createContext<GuardContext | null>(null);

/** One router blocker covers every editable form, including forms on the same page. */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const message = messages[locale ?? 'en'];
  const [guards] = useState(() => new Map<symbol, boolean>());
  const bypass = useRef(false);
  const hasChanges = useCallback(() => [...guards.values()].some(Boolean), [guards]);
  const blocker = useBlocker(useCallback(() => !bypass.current && hasChanges(), [hasChanges]));
  const handledLocation = useRef<string | null>(null);

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      handledLocation.current = null;
      return;
    }
    if (handledLocation.current === blocker.location.key) return;
    handledLocation.current = blocker.location.key;
    if (!hasChanges() || window.confirm(message)) blocker.proceed();
    else blocker.reset();
  }, [blocker, hasChanges, message]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasChanges()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasChanges]);

  const confirmDiscard = useCallback((action: () => void) => {
    if (hasChanges() && !window.confirm(message)) return false;
    // Auth must remain intact until the user accepts. Only this synchronous
    // navigation may bypass the router prompt; later edits still stay protected.
    bypass.current = true;
    try { action(); } finally { bypass.current = false; }
    return true;
  }, [hasChanges, message]);
  const value = useMemo(() => ({ guards, confirmDiscard }), [guards, confirmDiscard]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useGuardContext() {
  const context = useContext(Context);
  if (!context) throw new Error('Unsaved changes protection requires UnsavedChangesProvider.');
  return context;
}

/** Register local edits; the returned confirmation protects same-page replacement. */
export function useUnsavedChanges(dirty: boolean) {
  const { guards } = useGuardContext();
  const { locale } = useI18n();
  const [id] = useState(() => Symbol('unsaved form'));
  useLayoutEffect(() => {
    guards.set(id, dirty);
    return () => { guards.delete(id); };
  }, [dirty, guards, id]);
  return useCallback((hasChanges = dirty) => !hasChanges || window.confirm(messages[locale ?? 'en']), [dirty, locale]);
}

/** Confirm before a destructive side effect such as signing out, then navigate. */
export function useConfirmDiscard() {
  return useGuardContext().confirmDiscard;
}
