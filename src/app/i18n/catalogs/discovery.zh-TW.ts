import type { discoveryEn } from './discovery';

export const discoveryZhTW: Record<keyof typeof discoveryEn, string> = {
  browseLoadMore: '載入更多展覽', createSteps: '建立你的展覽',
  createUploadStep: '1. 上傳作品', createPreviewStep: '2. 檢查預覽', createPublishStep: '3. 發佈分享',
  createUploadHint: '先上傳一張圖片，系統會自動產生預覽；之後可以繼續加入作品。',
  createPreviewHint: '檢查作品與展覽名稱。按下「發佈展覽」之前，展覽不會公開。',
  createShareHint: '展覽已公開，分享連結即可讓訪客免登入參觀。',
  createCopyFailed: '無法複製連結，請選取下方網址手動複製。', createPublicLink: '公開展覽連結',
};
