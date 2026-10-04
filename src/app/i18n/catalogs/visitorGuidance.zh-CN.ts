import type { visitorGuidanceZhTW } from './visitorGuidance.zh-TW';

export const visitorGuidanceZhCN: Record<keyof typeof visitorGuidanceZhTW, string> = {
  agentModeWelcomeDesc: '选择自行参观，或让 AI 导览陪你探索作品。',
  visitorHelpTitle: '参观操作说明',
  visitorHelpMove: '移动与转向',
  visitorHelpDesktopMove: '点一下展厅，以 WASD 移动、鼠标转向。按 Esc 可释放鼠标，使用画面按钮。',
  visitorHelpTouchMove: '用左下角摇杆移动，在右半边画面拖曳以转换视角。',
  visitorHelpArtwork: '看看作品',
  visitorHelpDesktopArtwork: '点选作品阅读详情；关闭详情后可继续参观。',
  visitorHelpTouchArtwork: '靠近作品，按画面上的互动按钮阅读详情。',
  visitorHelpGuide: '开启导览',
  visitorHelpGuideCopy: '选择 AI 陪伴可直接提问；关闭面板后，可由右上角导览按钮再次开启。',
  visitorHelpDone: '知道了，收起提示',
  guideQuickTitle: '从一个问题开始',
  guideFocus: '当前作品：{title}',
  guideNoFocus: '先靠近或打开一件作品，再问它的特色；也可以先获取下一件作品建议。',
  guideIntroduce: '介绍这件作品',
  guideHighlight: '这件作品有什么特色？',
  guideRecommend: '推荐下一件',
  guideRecommendation: '接下来可以看看「{title}」。想前往时，按「带我去看看」开始导览。',
  guideRecommendationReason: '另一件可参观的作品',
  guideNoAlternative: '当前没有其他可推荐的作品。',
};
