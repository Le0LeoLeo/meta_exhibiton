import OpenAI from 'openai';

function getApiKey() {
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';
}

function getQwenBaseUrl() {
  return (
    process.env.QWEN_BASE_URL ||
    process.env.QWEN_API_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/$/, '');
}

function createQwenClient(apiKey, baseUrl, timeoutMs) {
  return new OpenAI({
    apiKey,
    baseURL: baseUrl,
    timeout: timeoutMs,
  });
}

function normalizeCompletionContent(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        return part?.text || '';
      })
      .join('')
      .trim();
  }
  return String(content || '').trim();
}

async function callQwenChat({ apiKey, baseUrl, model, messages, timeoutMs }) {
  const client = createQwenClient(apiKey, baseUrl, timeoutMs);
  const completion = await client.chat.completions.create({
    model,
    messages,
    stream: false,
    top_p: 0.9,
    temperature: 0.7,
    enable_search: false,
    enable_thinking: false,
    result_format: 'message',
  });
  return normalizeCompletionContent(completion?.choices?.[0]?.message?.content);
}

const FEEDBACK_SUMMARY_SYSTEM_PROMPT =
  '你是一個作品反饋整理助手。請將多位參觀者對同一件展品的留言，'
  + '整理成有結構的摘要，包含常見觀點、建議與重複出現的關鍵詞。'
  + '請使用繁體中文，以段落形式輸出，不用 Markdown 或條列。';

const POLISH_INTRO_SYSTEM_PROMPT =
  '你是一個展覽文案潤飾助手。請將使用者的作品介紹潤飾得更流暢、有吸引力，'
  + '保留所有事實資訊，不捏造內容。請使用繁體中文，以段落形式輸出。';

const TRANSLATE_SYSTEM_PROMPT =
  '你是一個展覽翻譯助手。請將輸入的展覽或作品文字翻譯成指定的目標語言，'
  + '保留所有事實資訊，不捏造內容。只輸出翻譯結果，不加說明。';

function buildFeedbackSummaryFallback(comments) {
  if (!comments || comments.length === 0) {
    return '目前暫無留言可供整理。'; 
  }
  const count = comments.length;
  return `共收到 ${count} 則留言。主要的關注方向包括作品主題與呈現手法。詳細建議可逐一查看留言內容。`;
}

function buildPolishIntroFallback(originalText) {
  if (!originalText || !originalText.trim()) {
    return '請先輸入作品介紹文字。';
  }
  return originalText.trim();
}

function buildTranslateFallback(text, targetLanguage) {
  if (!text || !text.trim()) {
    return ''; 
  }
  return `[${targetLanguage}] ${text.trim()}`;
}

/**
 * Summarize feedback comments into actionable suggestions.
 * @param {Array<{author: string, content: string}>} comments
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<string>}
 */
export async function summarizeFeedback(comments, { timeoutMs } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return buildFeedbackSummaryFallback(comments);
  }

  const model = process.env.QWEN_MODEL || 'qwen3.6-plus';
  const baseUrl = getQwenBaseUrl();
  const effectiveTimeout = Number(timeoutMs ?? process.env.QWEN_TIMEOUT_MS ?? 15000);

  const commentsText = (comments || [])
    .map((c, i) => `留言 ${i + 1}：${c.author ? `(${c.author}) ` : ''}${c.content}`)
    .join('\n');

  const userMessage = commentsText
    ? `以下是多位參觀者對同一件作品的留言，請整理成摘要：\n\n${commentsText}`
    : '目前沒有留言，請回覆「暫無留言可供整理」。';

  try {
    return await callQwenChat({
      apiKey,
      baseUrl,
      model,
      messages: [
        { role: 'system', content: FEEDBACK_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      timeoutMs: effectiveTimeout,
    });
  } catch (error) {
    console.error('[aiWritingService] summarizeFeedback failed', error);
    return buildFeedbackSummaryFallback(comments);
  }
}

/**
 * Polish an exhibition/exhibit introduction text.
 * @param {string} text - Original introduction text
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<string>}
 */
export async function polishIntro(text, { timeoutMs } = {}) {
  if (!text || !text.trim()) {
    return '';
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return buildPolishIntroFallback(text);
  }

  const model = process.env.QWEN_MODEL || 'qwen3.6-plus';
  const baseUrl = getQwenBaseUrl();
  const effectiveTimeout = Number(timeoutMs ?? process.env.QWEN_TIMEOUT_MS ?? 15000);

  try {
    return await callQwenChat({
      apiKey,
      baseUrl,
      model,
      messages: [
        { role: 'system', content: POLISH_INTRO_SYSTEM_PROMPT },
        { role: 'user', content: `請潤飾以下作品介紹：\n\n${text.trim()}` },
      ],
      timeoutMs: effectiveTimeout,
    });
  } catch (error) {
    console.error('[aiWritingService] polishIntro failed', error);
    return buildPolishIntroFallback(text);
  }
}

/**
 * Translate text to a target language.
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language (e.g., '英文', '葡萄牙文')
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<string>}
 */
export async function translateText(text, targetLanguage, { timeoutMs } = {}) {
  if (!text || !text.trim()) {
    return '';
  }
  if (!targetLanguage || !targetLanguage.trim()) {
    return text.trim();
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return buildTranslateFallback(text, targetLanguage);
  }

  const model = process.env.QWEN_MODEL || 'qwen3.6-plus';
  const baseUrl = getQwenBaseUrl();
  const effectiveTimeout = Number(timeoutMs ?? process.env.QWEN_TIMEOUT_MS ?? 15000);

  try {
    return await callQwenChat({
      apiKey,
      baseUrl,
      model,
      messages: [
        { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
        { role: 'user', content: `請將以下文字翻譯成${targetLanguage}：\n\n${text.trim()}` },
      ],
      timeoutMs: effectiveTimeout,
    });
  } catch (error) {
    console.error('[aiWritingService] translateText failed', error);
    return buildTranslateFallback(text, targetLanguage);
  }
}
