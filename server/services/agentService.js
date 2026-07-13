import OpenAI from 'openai';
import { getGrowthExhibitById, listGrowthAssetsByExhibitId } from '../db.js';

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

function getPreferredLanguage(visitorState = {}) {
  return visitorState.preferredLanguage || 'zh-TW';
}

function isEnglish(visitorState = {}) {
  return getPreferredLanguage(visitorState) === 'en';
}

function buildSystemPrompt(personality, userPreferences, visitorState, sessionState, recommendedExhibit) {
  const preferredLanguage = getPreferredLanguage(visitorState);
  const en = preferredLanguage === 'en';

  const styles = {
    xiaobai: en
      ? 'You are a friendly, beginner-friendly virtual exhibition guide. Explain clearly and warmly for first-time visitors.'
      : '你是一位親切、容易理解的虛擬展覽導覽員。請用溫暖清楚的語氣，讓第一次看展的人也能跟上。',
    expert: en
      ? 'You are a professional curator and exhibition guide. Be precise, contextual, and analytical without becoming stiff.'
      : '你是一位專業策展人與展覽導覽員。請提供精準、有脈絡的分析，但避免艱澀或過度正式。',
    humor: en
      ? 'You are a humorous but polite exhibition guide. Keep the tone light and fun without mocking artworks, artists, or visitors.'
      : '你是一位幽默但有禮貌的展覽導覽員。語氣可以輕鬆有趣，但不要嘲笑作品、藝術家或觀眾。',
  };

  const lengthInstruction = {
    short: en ? 'Keep the answer to 1 to 2 sentences.' : '請將回答控制在 1 到 2 句。',
    medium: en ? 'Keep the answer to 1 to 4 sentences.' : '請將回答控制在 1 到 4 句。',
    deep: en ? 'Provide a deeper answer of 4 to 6 sentences with concrete observations.' : '請提供 4 到 6 句較深入的回答，並加入具體觀察。',
  };

  const styleInstruction = {
    story: en ? 'Use storytelling to help visitors imagine the context behind the work.' : '請用敘事方式，幫助觀眾想像作品背後的情境。',
    educational: en ? 'Focus on educational value: explain elements, context, and ways to view the work.' : '請聚焦教育價值，說明元素、脈絡與觀看方式。',
    emotional: en ? 'Focus on emotional connection and guide visitors toward what the work may evoke.' : '請聚焦情感連結，引導觀眾感受作品可能喚起的情緒。',
  };

  const dwellEntries = Object.entries(visitorState?.dwellSecondsByExhibit || {});
  const topDwell = dwellEntries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, seconds]) => `${id}:${Math.round(seconds)}s`)
    .join(', ');

  const tourProgress = sessionState?.tourProgress;
  const tourHint = tourProgress
    ? en
      ? `Tour progress: stop ${tourProgress.currentStopIndex ?? 0} of ${tourProgress.totalStops ?? 0}.`
      : `導覽進度：第 ${tourProgress.currentStopIndex ?? 0} / ${tourProgress.totalStops ?? 0} 站。`
    : '';

  const recommendationHint = recommendedExhibit
    ? en
      ? `Recommended next exhibit: ${recommendedExhibit.title}. Reason: ${recommendedExhibit.reason}.`
      : `建議下一件作品：${recommendedExhibit.title}。原因：${recommendedExhibit.reason}。`
    : '';

  return [
    styles[personality] || styles.xiaobai,
    en ? 'You MUST answer in English.' : preferredLanguage === 'zh-CN' ? '你必須使用簡體中文回答。' : '你必須使用繁體中文回答。',
    en
      ? 'Only answer based on the provided exhibit data. If information is insufficient, say what can be observed and do not fabricate authors, dates, backgrounds, or facts.'
      : '只能根據提供的展品資料回答。若資訊不足，請說明可觀察到的內容，不要編造作者、年代、背景或不存在的事實。',
    en
      ? 'Avoid Markdown headings, bullet points, and report-like formatting. Speak like a live guide.'
      : '避免使用 Markdown 標題、項目符號或報告式格式。請像現場導覽員一樣自然說明。',
    lengthInstruction[userPreferences?.answerLength] || lengthInstruction.medium,
    styleInstruction[userPreferences?.guideStyle] || styleInstruction.educational,
    topDwell
      ? en
        ? `Visitor dwell-time signals: ${topDwell}.`
        : `觀眾停留時間訊號：${topDwell}。`
      : '',
    tourHint,
    recommendationHint,
  ].filter(Boolean).join(' ');
}

function buildGrowthExhibitContext(exhibit, assets) {
  if (!exhibit) return null;
  return {
    id: exhibit.id,
    title: exhibit.title,
    artist: exhibit.artist,
    description: exhibit.description,
    externalUrl: exhibit.externalUrl,
    type: exhibit.type,
    position: exhibit.position,
    assets: assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      title: asset.title,
      contentUrl: asset.content_url,
      note: asset.note,
      capturedAt: asset.captured_at,
    })),
  };
}

function buildSceneExhibitContext(exhibit) {
  if (!exhibit) return null;
  return {
    id: exhibit.id,
    title: exhibit.title || null,
    artist: exhibit.artist || null,
    description: exhibit.description || null,
    content: exhibit.content || null,
    type: exhibit.type || null,
    position: Array.isArray(exhibit.position) ? exhibit.position : null,
  };
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
    temperature: 0.5,
    enable_search: false,
    enable_thinking: false,
    result_format: 'message',
  });

  return normalizeCompletionContent(completion?.choices?.[0]?.message?.content);
}

function summarizeChatHistory(chatHistory = []) {
  return chatHistory
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join('\n');
}

function buildRecommendationReason({ best, exhibit, visited, engaged, dwell, lastRecommendedId, en }) {
  const reasons = [];

  if (exhibit?.type && best.type === exhibit.type) {
    reasons.push(en ? 'same type as the current exhibit' : '同類型作品，適合接續觀看');
  }

  if (!visited.has(best.id)) {
    reasons.push(en ? 'unvisited' : '尚未看過');
  }

  if (!engaged.has(best.id)) {
    reasons.push(en ? 'not deeply engaged yet' : '尚未深入互動');
  }

  if ((dwell[best.id] || 0) > 0) {
    reasons.push(en ? 'you have already shown some interest nearby' : `你曾停留約 ${Math.round(dwell[best.id])} 秒，值得再看一次`);
  }

  if (lastRecommendedId && best.id !== lastRecommendedId) {
    reasons.push(en ? 'different from the previous recommendation' : '避開上一次推薦，提供新的方向');
  }

  return reasons.join(en ? '; ' : '；') || (en ? 'it is a good next stop from your current position' : '它離目前位置合適，適合作為下一站');
}

function buildRecommendation({ exhibit, nearbyExhibits = [], visitorState = {} }) {
  const visited = new Set(visitorState?.visitedExhibitIds || []);
  const engaged = new Set(visitorState?.engagedExhibitIds || []);
  const dwell = visitorState?.dwellSecondsByExhibit || {};
  const lastRecommendedId = visitorState?.lastRecommendedExhibitId || null;
  const en = isEnglish(visitorState);

  const candidates = nearbyExhibits.filter((item) => item?.id && item.id !== exhibit?.id);
  if (candidates.length === 0) return null;

  const scored = candidates
    .map((item, index) => {
      let score = 0;
      if (!visited.has(item.id)) score += 3;
      if (!engaged.has(item.id)) score += 2;
      if (exhibit?.type && item.type === exhibit.type) score += 2;
      score += Math.min((dwell[item.id] || 0) / 8, 2);
      if (lastRecommendedId && item.id === lastRecommendedId) score -= 4;
      return { item, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = scored[0]?.item;
  if (!best) return null;

  return {
    id: best.id,
    title: best.title || (en ? 'Untitled exhibit' : '未命名作品'),
    reason: buildRecommendationReason({ best, exhibit, visited, engaged, dwell, lastRecommendedId, en }),
  };
}

function buildFallbackReply({ question, exhibit, nearbyExhibits = [], recommendation, visitorState = {}, chatHistory = [] }) {
  const en = isEnglish(visitorState);

  const exhibitTitle = exhibit?.title || (en ? 'this artwork' : '這件作品');
  const artistText = exhibit?.artist ? (en ? ` by ${exhibit.artist}` : `，作者是 ${exhibit.artist}`) : '';
  const descriptionText = exhibit?.description
    ? (en ? `Description: ${exhibit.description}` : `作品說明：${exhibit.description}`)
    : (en
      ? 'There is not much written information for this piece yet, so I would focus on what we can observe: color, material, scale, and placement.'
      : '目前這件作品的文字資料不多，我會先帶你觀察色彩、材質、尺度與擺放位置。');
  const contentText = exhibit?.content ? (en ? `Additional context: ${exhibit.content}` : `補充內容：${exhibit.content}`) : '';
  const nearbyText = nearbyExhibits.length > 0
    ? (en ? `There are ${nearbyExhibits.length} nearby exhibits we can connect to next.` : `附近還有 ${nearbyExhibits.length} 件作品可以接續觀看。`)
    : '';
  const historyHint = chatHistory?.length
    ? (en ? 'I am also keeping your recent questions in mind so the tour stays connected.' : '我也會參考你剛才的提問，讓導覽脈絡保持連續。')
    : '';
  const visitorHint = visitorState?.mode === 'tour'
    ? (en ? 'You are in tour mode, so I will connect this stop to the route.' : '你正在巡展模式中，我會把這一站和後面的路線串起來。')
    : visitorState?.followUser
      ? (en ? 'I will follow your pace and point out key details as you move.' : '我會跟著你的步調移動，沿路提示值得看的細節。')
      : '';
  const dwellHint = Object.entries(visitorState?.dwellSecondsByExhibit || {}).sort((a, b) => b[1] - a[1])[0];
  const dwellText = dwellHint
    ? (en ? `You spent about ${Math.round(dwellHint[1])}s near ${dwellHint[0]}, so that may be worth revisiting.` : `你曾在 ${dwellHint[0]} 附近停留約 ${Math.round(dwellHint[1])} 秒，也許值得回頭再看。`)
    : '';
  const recommendationHint = recommendation
    ? (en ? `Next, I recommend "${recommendation.title}" because ${recommendation.reason}.` : `接下來我建議看「${recommendation.title}」，因為${recommendation.reason}。`)
    : '';

  const artistQ = en ? /artist|who created|who made/i : /作者|誰創作|誰做|藝術家/i;
  const introQ = en ? /introduce|describe|explain|what is|tell me about/i : /介紹|說明|解釋|這件作品|作品|導覽/i;

  if (artistQ.test(question) && exhibit?.artist) {
    return en
      ? `${exhibitTitle} was created by ${exhibit.artist}. ${recommendationHint}`.trim()
      : `${exhibitTitle}的作者是 ${exhibit.artist}。${recommendationHint}`.trim();
  }

  const base = en
    ? `${exhibitTitle}${artistText}. ${descriptionText}`
    : `${exhibitTitle}${artistText}。${descriptionText}`;

  const parts = introQ.test(question)
    ? [base, contentText, nearbyText, historyHint, visitorHint, dwellText, recommendationHint]
    : [base, contentText, nearbyText, historyHint, visitorHint, dwellText, recommendationHint];

  return parts.filter(Boolean).join(en ? ' ' : '').trim();
}

export async function generateAgentReply({
  question,
  personality,
  exhibitId,
  exhibit,
  nearbyExhibits = [],
  chatHistory = [],
  visitorState = {},
  sessionState = null,
  userPreferences = null,
}) {
  const en = isEnglish(visitorState);

  if (!question?.trim()) {
    return {
      answer: en
        ? 'Tell me which artwork you want to explore, or ask something like "What should I notice in this piece?"'
        : '請告訴我你想了解哪一件作品，或直接問我「這件作品有什麼值得看？」',
      source: 'fallback',
      recommendedExhibit: null,
    };
  }

  const dbExhibit = exhibitId ? await getGrowthExhibitById(exhibitId).catch(() => null) : null;
  const dbAssets = dbExhibit ? await listGrowthAssetsByExhibitId(dbExhibit.id).catch(() => []) : [];
  const resolvedExhibit = dbExhibit ? buildGrowthExhibitContext(dbExhibit, dbAssets) : buildSceneExhibitContext(exhibit);
  const resolvedNearbyExhibits = Array.isArray(nearbyExhibits)
    ? nearbyExhibits.map(buildSceneExhibitContext).filter(Boolean)
    : [];
  const recommendedExhibit = buildRecommendation({
    exhibit: resolvedExhibit,
    nearbyExhibits: resolvedNearbyExhibits,
    visitorState,
  });

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      answer: buildFallbackReply({
        question,
        personality,
        exhibit: resolvedExhibit,
        nearbyExhibits: resolvedNearbyExhibits,
        recommendation: recommendedExhibit,
        visitorState,
        chatHistory,
      }),
      source: 'fallback',
      recommendedExhibit,
    };
  }

  const model = process.env.QWEN_MODEL || 'qwen3.6-plus';
  const baseUrl = getQwenBaseUrl();
  const timeoutMs = Number(process.env.QWEN_TIMEOUT_MS || 15000);
  const messages = [
    { role: 'system', content: buildSystemPrompt(personality, userPreferences, visitorState, sessionState, recommendedExhibit) },
    {
      role: 'user',
      content: JSON.stringify({
        question,
        personality,
        exhibit: resolvedExhibit,
        nearbyExhibits: resolvedNearbyExhibits,
        chatHistory: summarizeChatHistory(chatHistory),
        visitorState,
        sessionState,
        userPreferences,
        recommendedExhibit,
      }),
    },
  ];

  try {
    const answer = await callQwenChat({ apiKey, baseUrl, model, messages, timeoutMs });
    return { answer, source: 'qwen', recommendedExhibit };
  } catch (error) {
    console.error('[agentService] qwen failed, fallback engaged', error);
    return {
      answer: buildFallbackReply({
        question,
        personality,
        exhibit: resolvedExhibit,
        nearbyExhibits: resolvedNearbyExhibits,
        recommendation: recommendedExhibit,
        visitorState,
        chatHistory,
      }),
      source: 'fallback',
      recommendedExhibit,
    };
  }
}
