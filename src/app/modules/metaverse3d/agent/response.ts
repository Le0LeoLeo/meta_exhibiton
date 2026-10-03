import type { AgentPersonality, AgentResponseContext } from "./types";

const personalityProfiles: Record<AgentPersonality, { label: string; tone: string }> = {
  xiaobai: { label: "小白", tone: "簡單、親切、容易懂" },
  expert: { label: "專家", tone: "專業、詳細、具知識性" },
  humor: { label: "搞笑", tone: "幽默、活潑、適度輕鬆" },
};

/** Local, metadata-only fallback. Never claim to see details that were not supplied. */
export function getAgentResponse(ctx: AgentResponseContext) {
  const en = ctx.preferredLanguage === 'en';
  const work = ctx.exhibit;
  if (!work) return en
    ? "Which work caught your eye? Open a work or move closer, and we can explore it together."
    : "哪一件作品吸引了你？打開作品或走近一些，我們就能一起聊聊。";
  const title = work.title?.trim() || (en ? 'This work' : '這件作品');
  if (work.imageUrl) return en
    ? `Image analysis is unavailable right now. I only have the written information for ${title}${work.description ? `: ${work.description.slice(0, 360)}` : '.'}`
    : `目前無法分析圖片，只能讀取「${title}」的文字資料${work.description ? `：${work.description.slice(0, 360)}` : '。'}`;
  if (/作者|藝術家|誰創作|artist|who (made|created)/i.test(ctx.question)) {
    return work.artist?.trim()
      ? en ? `${title} was created by ${work.artist}.` : `「${title}」的作者是 ${work.artist}。`
      : en ? `The available information does not name the artist of ${title}.` : `「${title}」目前沒有提供作者資料，我不想替它猜一個名字。`;
  }
  if (/你好|哈囉|hello|^hi[!. ]?$/i.test(ctx.question)) {
    return en ? `Hi! We can start with ${title}, or explore at your own pace.` : `你好！可以先聊聊「${title}」，也可以照你的步調逛。`;
  }
  const description = work.description?.trim();
  const prefix = ctx.personality === 'humor'
    ? en ? "Let's give this one a moment. " : "先把趕行程模式關一下。"
    : '';
  if (!description) return en
    ? `${title} has little written context available. What draws your attention to it? We can use that as a starting point without guessing its background.`
    : `「${title}」的文字資料還不多。你最先注意到的是什麼？我們可以從那裡開始，不急著替作品下定論。`;
  const summary = description.length > 360 ? `${description.slice(0, 360)}…` : description;
  return en
    ? `${prefix}${title}${work.artist ? ` by ${work.artist}` : ''}: ${summary}`
    : `${prefix}「${title}」${work.artist ? `，作者是 ${work.artist}` : ''}。${summary}`;
}

export function getAgentPersonalityLabel(personality: AgentPersonality) { return personalityProfiles[personality].label; }
export function getAgentPersonalityTone(personality: AgentPersonality) { return personalityProfiles[personality].tone; }
