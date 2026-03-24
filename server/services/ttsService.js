function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractAudioBufferFromJson(jsonLike) {
  if (!jsonLike || typeof jsonLike !== 'object') return null;

  const candidates = [
    jsonLike?.output?.audio?.data,
    jsonLike?.output?.audio,
    jsonLike?.data?.audio,
    jsonLike?.audio,
    jsonLike?.output?.data,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      try {
        return Buffer.from(value.trim(), 'base64');
      } catch {
        // ignore and continue
      }
    }
  }

  return null;
}

export async function generateGuideTtsAudio({ title, artist, description, voice }) {
  const intlApiKeys = [
    process.env.DASHSCOPE_API_KEY_INTL,
    process.env.QWEN_API_KEY_INTL,
    process.env.DASHSCOPE_INTL_API_KEY,
    process.env.QWEN_INTL_API_KEY,
  ].filter((v, idx, arr) => typeof v === 'string' && v.trim() && arr.indexOf(v) === idx);

  const cnApiKeys = [
    process.env.DASHSCOPE_API_KEY_CN,
    process.env.QWEN_API_KEY_CN,
    process.env.DASHSCOPE_API_KEY,
    process.env.QWEN_API_KEY,
  ].filter((v, idx, arr) => typeof v === 'string' && v.trim() && arr.indexOf(v) === idx);

  if (!intlApiKeys.length && !cnApiKeys.length) {
    throw new Error(
      'DashScope API key not found. Set DASHSCOPE_API_KEY_INTL/QWEN_API_KEY_INTL for Singapore and DASHSCOPE_API_KEY_CN/QWEN_API_KEY_CN (or DASHSCOPE_API_KEY/QWEN_API_KEY) for Beijing.',
    );
  }

  const model = process.env.QWEN_TTS_MODEL || 'qwen3-tts-flash';
  const selectedVoice = typeof voice === 'string' && voice.trim() ? voice.trim() : 'Cherry';
  const timeoutMs = clamp(Number(process.env.QWEN_TTS_TIMEOUT_MS || 30000), 5000, 90000);

  const hasIntlKey = intlApiKeys.length > 0;
  const hasCnKey = cnApiKeys.length > 0;

  const endpointCandidates = [
    process.env.QWEN_TTS_ENDPOINT,
    'https://dashscope.aliyuncs.com/compatible-mode/v1/audio/speech',
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/audio/speech',
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2speech/generation',
    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2speech/generation',
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  ].filter((v, idx, arr) => {
    if (!(typeof v === 'string' && v.trim()) || arr.indexOf(v) !== idx) return false;
    const isIntl = v.includes('dashscope-intl.aliyuncs.com');
    if (isIntl && !hasIntlKey) return false;
    if (!isIntl && !hasCnKey) return false;
    return true;
  });

  const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : '未命名作品';
  const safeArtist = typeof artist === 'string' && artist.trim() ? artist.trim() : '未知作者';
  const safeDescription = typeof description === 'string' && description.trim() ? description.trim() : '暫無描述';

  const guideText = [
    '接下來為您介紹作品。',
    `作品標題：${safeTitle}。`,
    `作者：${safeArtist}。`,
    `作品描述：${safeDescription}。`,
    '感謝您的聆聽。',
  ].join('');

  let lastError = null;

  for (const endpoint of endpointCandidates) {
    const isCompatibleMode = endpoint.includes('/compatible-mode/');
    const isMultimodalGeneration = endpoint.includes('/multimodal-generation/');
    const isIntlEndpoint = endpoint.includes('dashscope-intl.aliyuncs.com');

    const requestBody = isCompatibleMode
      ? {
          model,
          voice: selectedVoice,
          input: guideText,
          format: 'mp3',
        }
      : isMultimodalGeneration
        ? {
            model,
            input: {
              text: guideText,
              voice: selectedVoice,
              language_type: 'Chinese',
            },
          }
        : {
            model,
            input: {
              text: guideText,
            },
            parameters: {
              voice: selectedVoice,
              format: 'mp3',
            },
          };

    const primaryKeys = isIntlEndpoint ? intlApiKeys : cnApiKeys;
    const fallbackKeys = isIntlEndpoint ? cnApiKeys : intlApiKeys;
    const keyCandidates = [...primaryKeys, ...fallbackKeys].filter(
      (v, idx, arr) => typeof v === 'string' && v.trim() && arr.indexOf(v) === idx,
    );

    for (const apiKey of keyCandidates) {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        timeoutMs,
      );

      if (response.ok) {
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();

        if (contentType.includes('audio/')) {
          const audioBuffer = await response.arrayBuffer();
          return Buffer.from(audioBuffer);
        }

        if (contentType.includes('application/json') || contentType.includes('text/json')) {
          const payload = await response.json().catch(() => null);
          const audioFromJson = extractAudioBufferFromJson(payload);
          if (audioFromJson) {
            return audioFromJson;
          }

          const audioUrl = payload?.output?.audio?.url || payload?.data?.audioUrl || payload?.audioUrl;
          if (typeof audioUrl === 'string' && audioUrl.trim()) {
            const audioResp = await fetchWithTimeout(audioUrl.trim(), {}, timeoutMs);
            if (audioResp.ok) {
              const audioBuffer = await audioResp.arrayBuffer();
              return Buffer.from(audioBuffer);
            }
          }

          lastError = new Error(
            `Qwen TTS API returned JSON without audio payload (endpoint: ${endpoint}) payload=${JSON.stringify(payload)}`,
          );
          continue;
        }

        const audioBuffer = await response.arrayBuffer();
        return Buffer.from(audioBuffer);
      }

      const errText = await response.text();
      const keyTag = isIntlEndpoint
        ? intlApiKeys.includes(apiKey)
          ? 'intl-key'
          : 'cn-key-fallback'
        : cnApiKeys.includes(apiKey)
          ? 'cn-key'
          : 'intl-key-fallback';
      lastError = new Error(
        `Qwen TTS API failed: ${response.status} ${errText} (endpoint: ${endpoint}, key=${keyTag})`,
      );
    }
  }

  throw (
    lastError ||
    new Error(
      'Qwen TTS API failed: no available endpoint. Please set QWEN_TTS_ENDPOINT from your Bailian model doc and verify region/API key.',
    )
  );
}
