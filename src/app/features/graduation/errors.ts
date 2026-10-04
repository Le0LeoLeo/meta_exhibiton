import { useI18n } from '@/app/components/I18nProvider';

const messages: Record<string, [string, string, string]> = {
  QUESTION_ANSWERED: ['這則提問已有回覆，你的文字仍保留。請重新載入查看。', '这则提问已有回复，你的文字仍保留。请重新载入查看。', 'This question already has a reply. Your text is preserved; reload to read it.'],
  CURATION_STALE: ['作品或審核狀態已更新，請重新整理分區並確認儲存後再發布。', '作品或审核状态已更新，请重新整理分区并确认保存后再发布。', 'Projects or approval states changed. Refresh and confirm the grouping before publishing.'],
  INVALID_CURATION: ['分區資料不完整，請確認每份作品只出現一次並填寫分區理由。', '分区资料不完整，请确认每份作品只出现一次并填写分区理由。', 'Check that every project appears exactly once and each group has a rationale.'],
  CURATION_LIMIT: ['作品數量超過本版策展上限，請拆分成較小的班級展。', '作品数量超过本版策展上限，请拆分成较小的班级展。', 'Too many projects for this curation version. Split the exhibition into smaller classes.'],
  NO_CURATION_PROJECTS: ['先有已提交或已核准的作品，才能整理策展分區。', '先有已提交或已核准的作品，才能整理策展分区。', 'Submit or approve projects before creating groups.'],
  REVISION_CONFLICT: ['資料已有新版本；你的輸入仍保留。請下載草稿副本，再重新載入最新資料。', '资料已有新版本；你的输入仍保留。请下载草稿副本，再重新载入最新资料。', 'A newer version exists. Your input is preserved. Download a draft copy before reloading.'],
  INVALID_EVIDENCE: ['所選來源不屬於這張能力卡。請重新載入並選擇卡片內已儲存的來源。', '所选来源不属于这张能力卡。请重新载入并选择卡片内已保存的来源。', 'A selected source does not belong to this card. Reload and choose a saved source on this card.'],
  INPUT_REVISION_CONFLICT: ['能力卡或來源在 AI 建議後已有更改。請重新檢視預覽，再以最新資料重新請求建議。', '能力卡或来源在 AI 建议后已有更改。请重新检查预览，再用最新资料重新请求建议。', 'The card or its sources changed after this AI run. Review the preview and request a fresh suggestion.'],
  SUGGESTION_NEEDS_REVIEW: ['佐證仍需核對。請閱讀問題及來源，再修改或不採用這份草稿。', '佐证仍需核对。请阅读问题及来源，再修改或不采用这份草稿。', 'The evidence needs checking. Read the questions and sources, then edit or reject this draft.'],
  DECISION_ALREADY_RECORDED: ['這項建議已有處理決定。請收起並重新開啟 AI 紀錄查看最新狀態。', '这项建议已有处理决定。请收起并重新打开 AI 记录查看最新状态。', 'A decision is already recorded for this suggestion. Reopen its history to see the latest status.'],
  DEADLINE_PASSED: ['投稿時間已截止，無法提交。', '投稿时间已截止，无法提交。', 'The submission deadline has passed.'],
  INVALID_DEADLINE: ['請選擇有效的未來截止時間。', '请选择有效的未来截止时间。', 'Choose a valid future deadline.'],
  INVITE_NOT_FOUND: ['找不到這個邀請碼，請向教師確認。', '找不到这个邀请码，请向教师确认。', 'Invitation code not found. Check with your teacher.'],
  INCOMPLETE_PROJECT: ['請先儲存作品名稱、研究問題、创作理念、創作過程及成果。', '请先保存作品名称、研究问题、创作理念、创作过程及成果。', 'Save the title, research question, concept, process and outcome before submitting.'],
  INVALID_STATUS: ['作品狀態已改變，目前無法執行此操作。請重新載入確認。', '作品状态已改变，目前无法执行此操作。请重新载入确认。', 'The project status does not allow this action. Reload to check its current state.'],
  PROJECT_EXISTS: ['你已在這個班級建立投稿，請重新載入以繼續編輯。', '你已在这个班级建立投稿，请重新载入以继续编辑。', 'You already have a project in this class. Reload to continue editing it.'],
  TEACHER_CANNOT_JOIN: ['你已是這個展覽的組展教師，無需以學生身分加入。', '你已是这个展览的组展教师，无需以学生身份加入。', 'You already organise this class and do not need to join as a student.'],
  INVALID_GALLERY: ['請選擇屬於自己的展覽。', '请选择属于自己的展览。', 'Select a gallery that you own.'],
  FEEDBACK_REQUIRED: ['退回前請填寫修改建議。', '退回前请填写修改建议。', 'Describe the requested changes before returning the project.'],
  NO_APPROVED_PROJECTS: ['至少核准一份作品後才能發布。', '至少核准一份作品后才能发布。', 'Approve at least one project before publishing.'],
  FORBIDDEN: ['你沒有權限查看或修改這份內容。', '你没有权限查看或修改这份内容。', 'You do not have access to this content.'],
  STUDENT_REQUIRED: ['此操作僅限已加入的參展學生。', '此操作仅限已加入的参展学生。', 'Only enrolled students can perform this action.'],
  TEACHER_REQUIRED: ['此操作僅限這個班級的組展教師。', '此操作仅限这个班级的组展教师。', 'Only the class organiser can perform this action.'],
  INVALID_INPUT: ['請檢查欄位內容與字數限制。', '请检查字段内容与字数限制。', 'Check the form values and length limits.'],
  NOT_FOUND: ['找不到這份內容，或內容已被移除。', '找不到这份内容，或内容已被移除。', 'This content was not found or has been removed.'],
  AUTH: ['登入已失效，請重新登入。', '登录已失效，请重新登录。', 'Your session has expired. Please sign in again.'],
  RATE_LIMIT: ['操作太頻繁，請稍後再試。', '操作太频繁，请稍后再试。', 'Too many requests. Please try again later.'],
  GENERIC: ['目前無法完成操作。你的輸入仍保留，請稍後重試。', '目前无法完成操作。你的输入仍保留，请稍后重试。', 'Unable to complete this action. Your input is preserved; please try again.'],
};
export function graduationErrorMessage(error: unknown, locale: string) {
  const detail = typeof error === 'object' && error !== null ? error as { code?: string; status?: number } : {};
  const code = detail.status === 429 ? 'RATE_LIMIT' : detail.status === 401 ? 'AUTH'
    : detail.code?.endsWith('_NOT_FOUND') && detail.code !== 'INVITE_NOT_FOUND' ? 'NOT_FOUND' : detail.code || 'GENERIC';
  return (messages[code] || messages.GENERIC)[locale === 'en' ? 2 : locale === 'zh-CN' ? 1 : 0];
}
export function useGraduationError() {
  const { locale } = useI18n();
  return (error: unknown) => graduationErrorMessage(error, locale);
}
