import type { AgentPersonality, AgentResponseContext } from "./types";

const personalityProfiles: Record<AgentPersonality, { label: string; tone: string; prefix: string }> = {
  xiaobai: { label: "小白", tone: "簡單、親切、容易懂", prefix: "我用簡單的方式說：" },
  expert: { label: "專家", tone: "專業、詳細、具知識性", prefix: "從展覽解讀角度來看：" },
  humor: { label: "搞笑", tone: "幽默、活潑、適度輕鬆", prefix: "嘿嘿，我來輕鬆講一下：" },
};

function buildExhibitSummary(ctx: AgentResponseContext) {
  const exhibit = ctx.exhibit ?? ctx.nearbyExhibits[0] ?? null;
  if (!exhibit) return null;

  return {
    title: exhibit.title?.trim() || "這件作品",
    artist: exhibit.artist?.trim() || "未知作者",
    description: exhibit.description?.trim() || "暫時沒有詳細說明。",
    content: exhibit.content?.trim() || "",
    type: exhibit.type,
  };
}

function formatReply(ctx: AgentResponseContext, base: string, summary: ReturnType<typeof buildExhibitSummary>) {
  const profile = personalityProfiles[ctx.personality];
  const keywords = [summary?.type, summary?.title].filter(Boolean).join(" / ");
  const supportLine = ctx.nearbyExhibits.length > 1 ? `我也注意到你身邊還有 ${ctx.nearbyExhibits.length} 件相鄰展品，可以順著一起看。` : "";
  const contextLine = ctx.question.length <= 14 ? "如果你願意，我也可以幫你延伸到作品背景、觀看重點或下一件推薦。" : "";

  const lines = [
    profile.prefix + base,
    keywords ? `關鍵資訊：${keywords}` : "",
    supportLine,
    contextLine,
  ].filter(Boolean);

  return lines.join("\n");
}

export function getAgentResponse(ctx: AgentResponseContext) {
  const summary = buildExhibitSummary(ctx);
  if (!summary) {
    return "我目前還沒有取得足夠的展品資料，請靠近作品或選取一件展品。";
  }

  const title = summary.title;
  const artist = summary.artist;
  const description = summary.description;
  const contentHint = summary.content ? `作品補充：${summary.content.slice(0, 120)}${summary.content.length > 120 ? "…" : ""}` : "";

  if (/作者|誰的作品|誰創作/.test(ctx.question)) {
    return formatReply(ctx, `這件作品的作者是 ${artist}。`, summary);
  }

  if (/做什麼|特色|亮點|是什麼|介紹|內容/.test(ctx.question)) {
    return formatReply(ctx, `這件作品的特色是：${description}`, summary);
  }

  if (/下一件|接下來|推薦|看哪個|逛哪/.test(ctx.question)) {
    return formatReply(ctx, `你可以接著看 ${title} 附近的展品，或者先停留在這裡感受一下 ${artist} 的創作語氣。`, summary);
  }

  if (/作品|展品|這件|這個/.test(ctx.question)) {
    return formatReply(ctx, `${title}，作者是 ${artist}。${description}${contentHint ? ` ${contentHint}` : ""}`, summary);
  }

  if (/你好|嗨|哈囉|hello/i.test(ctx.question)) {
    return formatReply(ctx, "你好，我可以幫你介紹附近展品，也能幫你找下一件值得看的作品。", summary);
  }

  return formatReply(ctx, `${title}，作者是 ${artist}。${description}${contentHint ? ` ${contentHint}` : ""}`, summary);
}

export function getAgentPersonalityLabel(personality: AgentPersonality) {
  return personalityProfiles[personality].label;
}

export function getAgentPersonalityTone(personality: AgentPersonality) {
  return personalityProfiles[personality].tone;
}
