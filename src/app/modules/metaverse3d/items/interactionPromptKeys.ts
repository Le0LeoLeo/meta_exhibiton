/** Maps the registry's built-in interaction prompts to i18n keys. */
const PROMPT_KEYS: Record<string, string> = {
  "觀看展品": "interactionView",
  "開燈": "interactionLightOn",
  "關燈": "interactionLightOff",
  "坐下": "interactionSit",
  "站起來": "interactionStand",
  "打開櫃門": "interactionOpenCabinet",
  "關上櫃門": "interactionCloseCabinet",
  "播放唱盤": "interactionPlayTurntable",
  "停止唱盤": "interactionStopTurntable",
  "啟動噴泉": "interactionStartFountain",
  "關閉噴泉": "interactionStopFountain",
};

export function localizeInteractionPrompt(prompt: string, t: (key: string) => string): string {
  const key = PROMPT_KEYS[prompt];
  return key ? t(key) : prompt;
}
