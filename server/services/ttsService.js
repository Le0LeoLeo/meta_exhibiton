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
        // Try the next response shape.
      }
    }
  }

  return null;
}

function uniqueNonEmpty(values) {
  return values.filter((value, index, arr) => typeof value === 'string' && value.trim() && arr.indexOf(value) === index);
}

function buildGuideText({ text, title, artist, description }) {
  if (typeof text === 'string' && text.trim()) return text.trim();

  const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : '未命名作品';
  const safeArtist = typeof artist === 'string' && artist.trim() ? artist.trim() : '未知作者';
  const safeDescription = typeof description === 'string' && description.trim() ? description.trim() : '暫無作品描述';

  return [
    '歡迎來到這件展品前。',
    `作品名稱是：${safeTitle}。`,
    `作者是：${safeArtist}。`,
    `作品描述：${safeDescription}。`,
    '請放慢腳步，觀察它的細節與情感。',
  ].join('');
}

export async function generateGuideTtsAudio({ text, title, artist, description, voice }) {
  const intlApiKeys = uniqueNonEmpty([
    process.env.DASHSCOPE_API_KEY_INTL,
    process.env.QWEN_API_KEY_INTL,
    process.env.DASHSCOPE_INTL_API_KEY,
    process.env.QWEN_INTL_API_KEY,
  ]);

  const cnApiKeys = uniqueNonEmpty([
    process.env.DASHSCOPE_API_KEY_CN,
    process.env.QWEN_API_KEY_CN,
    process.env.DASHSCOPE_API_KEY,
    process.env.QWEN_API_KEY,
  ]);

  if (!intlApiKeys.length && !cnApiKeys.length) {
    throw new Error(
      'DashScope API key not found. Set DASHSCOPE_API_KEY_INTL/QWEN_API_KEY_INTL for Singapore and DASHSCOPE_API_KEY_CN/QWEN_API_KEY_CN (or DASHSCOPE_API_KEY/QWEN_API_KEY) for Beijing.',
    );
  }

  const model = process.env.QWEN_TTS_MODEL || 'qwen3-tts-flash';
  const selectedVoice = typeof voice === 'string' && voice.trim() ? voice.trim() : 'Cherry';
  const timeoutMs = clamp(Number(process.env.QWEN_TTS_TIMEOUT_MS || 30000), 5000, 90000);
  const guideText = buildGuideText({ text, title, artist, description });

  const endpointCandidates = uniqueNonEmpty([
    process.env.QWEN_TTS_ENDPOINT,
    'https://dashscope.aliyuncs.com/compatible-mode/v1/audio/speech',
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/audio/speech',
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2speech/generation',
    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2speech/generation',
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  ]).filter((endpoint) => {
    const isIntl = endpoint.includes('dashscope-intl.aliyuncs.com');
    if (isIntl && !intlApiKeys.length) return false;
    if (!isIntl && !cnApiKeys.length) return false;
    return true;
  });

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
    const keyCandidates = uniqueNonEmpty([...primaryKeys, ...fallbackKeys]);

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
          if (audioFromJson) return audioFromJson;

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

        lastError = new Error(`Qwen TTS API returned unsupported content-type: ${contentType || 'unknown'}`);
        continue;
      }

      const errorText = await response.text().catch(() => '');
      lastError = new Error(`Qwen TTS API failed (${response.status}) endpoint=${endpoint} body=${errorText}`);
    }
  }

  throw lastError || new Error('Qwen TTS API failed: no endpoint candidates available');
}
