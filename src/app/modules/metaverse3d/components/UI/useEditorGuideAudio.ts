import { useCallback, useEffect, useRef, useState } from 'react';
import { buildGuideTtsText, loadAuth, requestQwenTts } from '@/app/api/client';
import { useI18n } from '@/app/components/I18nProvider';
import type { ExhibitItem } from '../../types';

export function useEditorGuideAudio(selectedItem: ExhibitItem | null | undefined) {
  const { t } = useI18n();
  const isMountedRef = useRef(true);
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioUrlRef = useRef<string | null>(null);
  const ttsRequestIdRef = useRef(0);

  const stopGuideAudio = useCallback((invalidatePending = true) => {
    if (invalidatePending) {
      ttsRequestIdRef.current += 1;
      if (isMountedRef.current) setIsTtsGenerating(false);
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current = null;
    }
    if (ttsAudioUrlRef.current) {
      URL.revokeObjectURL(ttsAudioUrlRef.current);
      ttsAudioUrlRef.current = null;
    }
    if (isMountedRef.current) {
      setIsTtsSpeaking(false);
    }
  }, []);

  const playGuideAudio = async () => {
    if (!selectedItem || selectedItem.type !== "painting") return;
    const requestId = ttsRequestIdRef.current + 1;
    ttsRequestIdRef.current = requestId;
    stopGuideAudio(false);
    setTtsError(null);
    setIsTtsGenerating(true);
    const guideItem = selectedItem;
    try {
      const { token } = loadAuth();
      if (!token) throw new Error(t('editorVoiceGuideFailed'));
      const text = buildGuideTtsText({
        title: guideItem.title,
        artist: guideItem.artist,
        description: guideItem.description || guideItem.content,
      });
      if (!text) throw new Error(t('editorVoiceGuideFailed'));
      const blob = await requestQwenTts(token, { text });
      if (!isMountedRef.current || ttsRequestIdRef.current !== requestId) return;
      stopGuideAudio(false);
      const url = URL.createObjectURL(blob);
      ttsAudioUrlRef.current = url;
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => {
        if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
          setIsTtsSpeaking(false);
        }
      };
      audio.onerror = () => {
        if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
          setTtsError(t('editorVoicePlayFailed'));
          setIsTtsSpeaking(false);
        }
      };
      await audio.play();
      if (!isMountedRef.current || ttsRequestIdRef.current !== requestId) {
        audio.pause();
        return;
      }
      setIsTtsSpeaking(true);
    } catch (err) {
      if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
        setTtsError(err instanceof Error ? err.message : t('editorVoiceGuideFailed'));
        setIsTtsSpeaking(false);
      }
    } finally {
      if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
        setIsTtsGenerating(false);
      }
    }
  };


  // Leaving the editor or selecting another work invalidates pending synthesis.
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; stopGuideAudio(); };
  }, [stopGuideAudio]);
  useEffect(() => { stopGuideAudio(); setTtsError(null); }, [selectedItem?.id, stopGuideAudio]);
  return { isTtsGenerating, isTtsSpeaking, ttsError, playGuideAudio, stopGuideAudio };
}
