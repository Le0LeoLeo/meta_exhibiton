export type CuratorIntent = "warm-memory" | "professional-gallery";

export const curatorIntentOptions: Array<{ value: CuratorIntent; label: string; summary: string }> = [
  {
    value: "warm-memory",
    label: "\u6eab\u6696\u56de\u61b6",
    summary: "\u4ee5\u4eba\u7269\u3001\u8a18\u61b6\u8207\u60c5\u611f\u7bc0\u594f\u4e32\u8d77\u5c55\u54c1\u3002",
  },
  {
    value: "professional-gallery",
    label: "\u5c08\u696d\u5c55\u89bd",
    summary: "\u4ee5\u6e05\u6670\u5206\u5340\u3001\u7cbe\u6e96\u8aaa\u660e\u8207\u7a69\u5b9a\u52d5\u7dda\u5448\u73fe\u3002",
  },
];

export const aiCuratorCopy = {
  title: "\u0041\u0049 \u7b56\u5c55\u52a9\u624b",
  scope: "目前依你輸入的主題與偏好產生策展文字草稿；不會讀取或分析現有展品的內容。",
  signInError: "\u8acb\u5148\u767b\u5165\u518d\u4f7f\u7528 AI \u7b56\u5c55\u3002",
  failed: "\u0041\u0049 \u7b56\u5c55\u751f\u6210\u5931\u6557",
  unchangedError: "\u9019\u6b21\u6c92\u6709\u6210\u529f\u751f\u6210\u8a08\u5283\u3002\u4f60\u7684\u5c55\u5834\u4ecd\u7136\u4fdd\u6301\u539f\u72c0\uff0c\u53ef\u4ee5\u7a0d\u5f8c\u91cd\u8a66\u3002",
  theme: "\u5c55\u89bd\u4e3b\u984c",
  themePlaceholder: "\u4f8b\u5982\uff1a\u6fb3\u9580\u975e\u907a\u6587\u5316\u5c55",
  intent: "\u7b56\u5c55\u65b9\u5411",
  style: "\u98a8\u683c",
  whiteBox: "\u767d\u76d2\u5c55\u5ef3",
  warmMuseum: "\u6eab\u6696\u535a\u7269\u9928",
  techShowroom: "\u79d1\u6280\u5c55\u5ef3",
  historyGallery: "\u6b77\u53f2\u5c55\u5ef3",
  immersive: "\u6c89\u6d78\u5f0f",
  exhibits: "\u5c55\u54c1\u6578",
  audience: "\u76ee\u6a19\u89c0\u773e",
  audiencePlaceholder: "\u4f8b\u5982\uff1a\u4e2d\u5b78\u751f\u3001\u89aa\u5b50\u89c0\u773e\u3001\u4f01\u696d\u8a2a\u5ba2",
  language: "\u8a9e\u8a00",
  zhTw: "\u7e41\u9ad4\u4e2d\u6587",
  zhCn: "\u7c21\u9ad4\u4e2d\u6587",
  applyMode: "\u5957\u7528\u65b9\u5f0f",
  replace: "\u91cd\u5efa\u5c55\u5ef3",
  preserveExisting: "\u4fdd\u7559\u73fe\u6709\u5c55\u54c1",
  generating: "正在依主題整理策展文字草稿，目前不會改動展場。",
  generate: "\u751f\u6210\u7b56\u5c55\u65b9\u6848",
  preview: "\u7b56\u5c55\u9810\u89bd",
  intentSummary: "\u7b56\u5c55\u65b9\u5411",
  replaceWarning: "重建展廳會用 AI 草稿的文字物件取代目前場景物件；現有展品將從場景移除。請先保存副本，或改選「保留現有展品」。",
  preserveWarning: "保留現有展品及原來位置，另外加入 AI 草稿的展區文字、示例展品文字和燈光；請檢查是否與現有展品重疊。",
  preserveDetail: "保留：現有展品、已上傳媒體的引用及目前位置。",
  changeDetail: "新增：標題、展區與示例展品文字及燈光。AI 不會自動重排現有作品。",
  confirmHint: "\u78ba\u8a8d\u5f8c\u624d\u6703\u5957\u7528\u5230\u76ee\u524d\u7de8\u8f2f\u5668\uff0c\u4f60\u4ecd\u53ef\u4ee5\u9010\u4ef6\u8abf\u6574\u3002",
  confirmApply: "\u78ba\u8a8d\u5957\u7528",
  applyToScene: "\u5957\u7528\u5230\u5c55\u5ef3",
  backToPreview: "\u8fd4\u56de\u9810\u89bd",
  discard: "\u6368\u68c4",
};

export function formatGeneratedCounts(sectionCount: number, exhibitCount: number) {
  return `${sectionCount} 個展區 / ${exhibitCount} 則示例展品文字`;
}

export function getCuratorIntentLabel(intent: CuratorIntent) {
  return curatorIntentOptions.find((option) => option.value === intent)?.label ?? curatorIntentOptions[0].label;
}
