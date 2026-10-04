import type { visitorGuidanceZhTW } from './visitorGuidance.zh-TW';

export const visitorGuidanceEn: Record<keyof typeof visitorGuidanceZhTW, string> = {
  agentModeWelcomeDesc: 'Explore on your own, or choose an AI companion to guide you through the works.',
  visitorHelpTitle: 'Visitor controls',
  visitorHelpMove: 'Move and look around',
  visitorHelpDesktopMove: 'Click the gallery, use WASD to move and the mouse to look around. Press Esc to release the mouse and use the buttons.',
  visitorHelpTouchMove: 'Move with the bottom-left joystick. Drag on the right half of the screen to look around.',
  visitorHelpArtwork: 'Explore a work',
  visitorHelpDesktopArtwork: 'Click a work to read its details. Close the details to continue exploring.',
  visitorHelpTouchArtwork: 'Move close to a work, then use the interaction button on screen to read its details.',
  visitorHelpGuide: 'Open your guide',
  visitorHelpGuideCopy: 'Choose AI Companion to ask questions. After closing the panel, reopen it with the guide button at the top right.',
  visitorHelpDone: 'Got it, hide tips',
  guideQuickTitle: 'Start with a question',
  guideFocus: 'Current work: {title}',
  guideNoFocus: 'Move closer to a work or open its details to ask about it. You can also ask for a suggestion first.',
  guideIntroduce: 'Introduce this work',
  guideHighlight: 'What stands out in this work?',
  guideRecommend: 'Suggest another work',
  guideRecommendation: 'You could explore “{title}” next. Choose “Take me there” when you want to start the guided route.',
  guideRecommendationReason: 'Another work available to explore',
  guideNoAlternative: 'There are no other works to suggest right now.',
};
