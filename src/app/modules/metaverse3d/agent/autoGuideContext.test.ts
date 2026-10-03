import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestAgentReply } from '@/app/api/client';
import { useStore } from '../store/useStore';
import { defaultAgentState } from '../store/metaverseStoreUtils';
import { useLocalPlayerStore } from '../network/localPlayerStore';
import { requestAutoGuideAnswer } from './behaviorHelpers';

vi.mock('@/app/api/client', () => ({ loadAuth: () => ({ token: 'test-token' }), requestAgentReply: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe('automatic guide context', () => {
  it('includes visitor language, memory and prior assistant replies just like manual chat', async () => {
    useStore.setState({ items: [], viewingItem: null,
      agent: { ...defaultAgentState, preferredLanguage: 'en', memory: { ...defaultAgentState.memory, visitedExhibitIds: ['seen'], lastRecommendedExhibitId: 'seen' } },
      agentChat: [{ id: 'reply', role: 'assistant', content: 'Earlier context', createdAt: 0 }],
    });
    useLocalPlayerStore.setState({ position: { x: 4, y: 1.6, z: 2 } });
    await requestAutoGuideAnswer({ question: 'Introduce this stop', personality: 'expert', exhibit: null, nearbyExhibits: [] });
    expect(requestAgentReply).toHaveBeenCalledWith('test-token', expect.objectContaining({
      visitorState: expect.objectContaining({ preferredLanguage: 'en', visitedExhibitIds: ['seen'], lastRecommendedExhibitId: 'seen', currentPosition: [4, 1.6, 2] }),
      chatHistory: [{ role: 'assistant', content: 'Earlier context' }], userPreferences: { answerLength: 'deep', guideStyle: 'educational' },
    }));
  });
});
