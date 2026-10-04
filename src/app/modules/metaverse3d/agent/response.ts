import type { AgentPersonality, AgentResponseContext } from "./types";

const personalityProfiles: Record<AgentPersonality, { label: string; tone: string }> = {
  xiaobai: { label: "小白", tone: "簡單、親切、容易懂" },
  expert: { label: "專家", tone: "專業、詳細、具知識性" },
  humor: { label: "搞笑", tone: "幽默、活潑、適度輕鬆" },
};

type WorkContextField = 'contribution' | 'process' | 'outcome' | 'reflection';

// Checked in order, so "what did they learn after changing it" is answered as a reflection.
const workContextQuestions: Array<{ field: WorkContextField; pattern: RegExp; en: string; zh: string }> = [
  { field: 'reflection', pattern: /學到|學會|反思|收穫|learn|reflect|takeaway/i, en: 'reflection', zh: '反思' },
  { field: 'process', pattern: /過程|怎樣做|怎麼做|修改|改了|改正|更正|回饋|process|how .*(made|make|created)|chang|fix|correct|feedback|revis/i, en: 'process', zh: '製作過程' },
  { field: 'outcome', pattern: /成果|結果|產出|outcome|result|produce|final/i, en: 'outcome', zh: '成果' },
  { field: 'contribution', pattern: /貢獻|負責|角色|分工|contribut|role|responsib|part did/i, en: 'contribution', zh: '個人貢獻' },
];

const visualQuestion = /畫面|顏色|色彩|構圖|看到|看起來|圖片|圖像|colou?r|composition|see in|look like|looks|visual|image|picture/i;

const clip = (text: string, limit: number) => text.length > limit ? `${text.slice(0, limit)}…` : text;

/** Local, metadata-only fallback. Never claim to see details that were not supplied. */
export function getAgentResponse(ctx: AgentResponseContext) {
  const en = ctx.preferredLanguage === 'en';
  const work = ctx.exhibit;
  if (!work) return en
    ? "Which work caught your eye? Open a work or move closer, and we can explore it together."
    : "哪一件作品吸引了你？打開作品或走近一些，我們就能一起聊聊。";
  const title = work.title?.trim() || (en ? 'This work' : '這件作品');
  const context = work.workContext;
  const limit = ctx.personality === 'expert' ? 600 : 360;
  if (/作者|藝術家|誰創作|artist|who (made|created)/i.test(ctx.question)) {
    return work.artist?.trim()
      ? en ? `${title} was created by ${work.artist}.` : `「${title}」的作者是 ${work.artist}。`
      : en ? `The available information does not name the artist of ${title}.` : `「${title}」目前沒有提供作者資料，我不想替它猜一個名字。`;
  }
  if (/你好|哈囉|hello|^hi[!. ]?$/i.test(ctx.question)) {
    return en ? `Hi! We can start with ${title}, or explore at your own pace.` : `你好！可以先聊聊「${title}」，也可以照你的步調逛。`;
  }
  if (context?.sources?.length && /來源|參考|出處|資料從哪|source|reference|cite|evidence/i.test(ctx.question)) {
    const sources = context.sources.map((source) => source.excerpt
      ? en ? `${source.label} (supplied excerpt: "${clip(source.excerpt, 200)}")` : `${source.label}（提供的摘錄：「${clip(source.excerpt, 200)}」）`
      : source.label);
    return en
      ? `The creator lists these sources for ${title}: ${sources.join('; ')}. I have not opened any linked pages, so please check them yourself.`
      : `創作者為「${title}」列出的參考資料：${sources.join('；')}。我沒有開啟任何連結，請自行核對。`;
  }
  const asked = workContextQuestions.find(({ field, pattern }) => context?.[field] && pattern.test(ctx.question));
  if (asked) {
    const answer = clip(context![asked.field]!, limit);
    return en
      ? `In the creator's own notes on ${title} (${asked.en}): ${answer} This is their account, not an independently checked fact.`
      : `根據創作者對「${title}」的自述（${asked.zh}）：${answer} 這是創作者的說法，並未經獨立核實。`;
  }
  const imageNote = work.imageUrl && visualQuestion.test(ctx.question)
    ? en ? "I can't analyze the image right now, so this uses the written information only. " : '目前無法分析圖片，以下只根據文字資料。'
    : '';
  const prefix = ctx.personality === 'humor'
    ? en ? "Let's give this one a moment. " : "先把趕行程模式關一下。"
    : '';
  const availableFields = workContextQuestions.filter(({ field }) => context?.[field]);
  const invitation = availableFields.length
    ? en
      ? ` The creator also shared their ${availableFields.map(({ en: label }) => label).join(', ')}. Ask about any of them.`
      : `創作者另外記錄了${availableFields.map(({ zh }) => zh).join('、')}，可以問問看。`
    : '';
  const description = work.description?.trim();
  if (!description) return en
    ? `${imageNote}${title} has little written description.${invitation || ' What draws your attention to it? We can use that as a starting point without guessing its background.'}`
    : `${imageNote}「${title}」的文字介紹還不多。${invitation || '你最先注意到的是什麼？我們可以從那裡開始，不急著替作品下定論。'}`;
  const summary = clip(description, limit);
  return en
    ? `${imageNote}${prefix}${title}${work.artist ? ` by ${work.artist}` : ''}: ${summary}${invitation}`
    : `${imageNote}${prefix}「${title}」${work.artist ? `，作者是 ${work.artist}` : ''}。${summary}${invitation}`;
}

export function getAgentPersonalityLabel(personality: AgentPersonality) { return personalityProfiles[personality].label; }
export function getAgentPersonalityTone(personality: AgentPersonality) { return personalityProfiles[personality].tone; }
