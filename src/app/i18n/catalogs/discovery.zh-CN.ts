import type { discoveryEn } from './discovery';

export const discoveryZhCN: Record<keyof typeof discoveryEn, string> = {
  browseLoadMore: '加载更多展览', createSteps: '创建你的展览',
  createUploadStep: '1. 上传作品', createPreviewStep: '2. 检查预览', createPublishStep: '3. 发布分享',
  createUploadHint: '先上传一张图片，系统会自动生成预览；之后可以继续加入作品。',
  createPreviewHint: '检查作品与展览名称。点击「发布展览」之前，展览不会公开。',
  createShareHint: '展览已公开，分享链接即可让访客免登录参观。',
  createCopyFailed: '无法复制链接，请选取下方网址手动复制。', createPublicLink: '公开展览链接',
};
