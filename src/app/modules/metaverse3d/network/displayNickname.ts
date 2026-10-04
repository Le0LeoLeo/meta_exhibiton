// The server names every signed-out visitor "Guest"; signed-in visitors use their account name.
export const GUEST_NICKNAME = "Guest";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Short, stable tag derived from a player id so several guests can be told apart.
 * Socket.IO ids start with random characters and end with a counter, so use the start. */
export function guestTag(playerId: string): string {
  return playerId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
}

/** Show account names as-is; give guests a localized, distinguishable label such as "Guest 7F3A". */
export function displayNickname(nickname: string | undefined, playerId: string, t: Translate): string {
  const name = (nickname ?? "").trim();
  if (name && name !== GUEST_NICKNAME) return name;
  const tag = guestTag(playerId);
  return tag ? t("multiplayerGuestName", { tag }) : t("multiplayerGuestNameNoTag");
}
