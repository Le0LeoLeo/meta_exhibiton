import { useI18n } from '@/app/components/I18nProvider';
const en = {
  title: 'Exhibition grouping', help: 'Suggest groups from submitted and approved project text only. Private feedback is excluded. Review themes, explanations and order before explicitly saving. Approve every grouped project, then refresh and save the plan before publishing.',
  suggest: 'Suggest groups', save: 'Confirm and save groups', cancel: 'Cancel request', saved: 'Confirmed plan saved.', unsaved: 'Unsaved changes — publication uses the last confirmed plan.',
  ai: 'AI suggestion', rules: 'Rule-based fallback', manual: 'Human-confirmed / manually edited', warning: 'AI is unavailable or returned an invalid response. Showing groups ordered by project creation time; this does not assess quality.',
  review: 'AI suggestions may be inaccurate. Human confirmation is required.', name: 'Group title', rationale: 'Grouping rationale', membership: 'Move to group', up: 'Move up', down: 'Move down', add: 'Add group', empty: 'Empty groups are removed when saving.', confirm: 'I reviewed the grouping and explanations.', stale: 'Projects changed. Request fresh suggestions, review and save again. Existing edits remain here.',
};
type Copy = typeof en;
const tw: Copy = {
  title: '展覽分組', help: '僅使用已投稿與已核准作品的文字提出分組，不包含私人評語。請檢查主題、理由與順序後明確儲存。發布前須核准所有分組作品，再更新建議並儲存。',
  suggest: '產生分組建議', save: '確認並儲存分組', cancel: '取消請求', saved: '已儲存確認的分組。', unsaved: '尚未儲存 — 發布使用上次確認的分組。',
  ai: 'AI 建議', rules: '規則備援分組', manual: '人工確認／手動編輯', warning: 'AI 無法使用或回應無效。目前依作品建立時間分組，未評估作品品質。',
  review: 'AI 建議可能不準確，需要人工確認。', name: '分組標題', rationale: '分組理由', membership: '移至分組', up: '上移', down: '下移', add: '新增分組', empty: '儲存時會移除空白分組。', confirm: '我已檢查分組與理由。', stale: '作品已有更新。請重新產生建議、檢查並儲存。目前編輯仍保留。',
};
const cn: Copy = {
  title: '展览分组', help: '仅使用已投稿与已核准作品的文字提出分组，不包含私人评语。请检查主题、理由与顺序后明确保存。发布前须核准所有分组作品，再更新建议并保存。',
  suggest: '生成分组建议', save: '确认并保存分组', cancel: '取消请求', saved: '已保存确认的分组。', unsaved: '尚未保存 — 发布使用上次确认的分组。',
  ai: 'AI 建议', rules: '规则备用分组', manual: '人工确认／手动编辑', warning: 'AI 无法使用或响应无效。目前按作品创建时间分组，未评估作品质量。',
  review: 'AI 建议可能不准确，需要人工确认。', name: '分组标题', rationale: '分组理由', membership: '移至分组', up: '上移', down: '下移', add: '新增分组', empty: '保存时会移除空白分组。', confirm: '我已检查分组与理由。', stale: '作品已有更新。请重新生成建议、检查并保存。目前编辑仍保留。',
};
export function useCurationCopy() { const { locale } = useI18n(); return { c: locale === 'en' ? en : locale === 'zh-CN' ? cn : tw, locale }; }
