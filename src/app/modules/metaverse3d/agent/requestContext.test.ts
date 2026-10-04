import { describe, expect, it } from "vitest";

import { buildAgentReplyRequest, buildVisitorAwareRequest, getAgentSceneExhibits } from "./requestContext";
import { defaultAgentState } from '../store/metaverseStoreUtils';
import type { AgentUserPreferencesPayload, AgentVisitorStatePayload } from "../../../api/agent";

const exhibit = {
  id: "painting-1",
  title: "Light Study",
  artist: "A Student",
  description: "Warm light study",
  content: "",
  type: "painting" as const,
  position: [0, 1.5, -2] as [number, number, number],
};

describe("buildAgentReplyRequest", () => {
  it('passes the selected work context to the Agent without unrelated fields', () => {
    const selected = { ...exhibit, workContext: { contribution: 'I designed the bridge', sources: [{ label: 'Test log', excerpt: 'Held 2 kg' }] },
      privateCv: 'never transmitted', rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    const request = buildVisitorAwareRequest({ question: 'What did I contribute?', agent: defaultAgentState,
      items: [selected], position: [0, 0, 0], viewingId: selected.id, chat: [] });
    expect(request.exhibit?.workContext).toEqual(selected.workContext);
    expect(request.exhibit).not.toHaveProperty('privateCv');
    expect(request.nearbyExhibits?.[0].workContext).toEqual(selected.workContext);
  });
  it('follows the currently selected work when the visitor switches artworks', () => {
    const first = { ...exhibit, id: 'first', title: 'First work', position: [0, 1, 0] as [number, number, number] };
    const second = { ...exhibit, id: 'second', title: 'Second work', position: [1, 1, 0] as [number, number, number] };
    const firstRequest = buildVisitorAwareRequest({ question: 'What do you think?', agent: defaultAgentState,
      items: [first, second], position: [0, 0, 0], viewingId: first.id, chat: [] });
    const switchedRequest = buildVisitorAwareRequest({ question: 'What do you think?', agent: defaultAgentState,
      items: [first, second], position: [0, 0, 0], viewingId: second.id, chat: [] });

    expect(firstRequest.exhibit?.id).toBe('first');
    expect(switchedRequest.exhibit?.id).toBe('second');
  });
  it('keeps a URL-only source as metadata and excludes non-scene or private fields', () => {
    const selected = { ...exhibit, workContext: { sources: [
      { label: 'Project page', url: 'https://example.org/project', internalNotes: 'private notes' },
    ] }, privateCv: 'private biography', rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    const outsideScene = { ...exhibit, id: 'private-note', title: 'Private note', type: 'text' as const,
      position: [1, 1, 0] as [number, number, number], content: 'Do not include this note' };
    const invalidPosition = { ...exhibit, id: 'off-scene', title: 'Off-scene work', position: [Number.NaN, 1, 0] as [number, number, number] };
    const request = buildVisitorAwareRequest({ question: 'Tell me about this work', agent: defaultAgentState,
      items: [selected, outsideScene, invalidPosition], position: [0, 0, 0], viewingId: selected.id, chat: [] });

    expect(request.exhibit?.workContext).toEqual({ sources: [{ label: 'Project page', url: 'https://example.org/project' }] });
    expect(request.exhibit?.workContext?.sources?.[0]).not.toHaveProperty('excerpt');
    expect(request.exhibit).not.toHaveProperty('privateCv');
    expect(request.nearbyExhibits?.map((item) => item.id)).toEqual([selected.id]);
    expect(JSON.stringify(request)).not.toContain('Do not include this note');
    expect(JSON.stringify(request)).not.toContain('private biography');
  });
  it('can discuss a named distant work outside the nearest eight', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ ...exhibit, id: `work-${i}`, title: `Artwork ${i}`, position: [i * 5, 1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] }));
    items[11].title = 'Distant horizon';
    const payload = buildVisitorAwareRequest({ question: 'Tell me about Distant horizon', agent: defaultAgentState, items, position: [0, 0, 0], viewingId: null, chat: [] });
    expect(payload.exhibit?.id).toBe('work-11');
    expect(payload.nearbyExhibits?.some((work) => work.id === 'work-11')).toBe(true);
    expect(payload.nearbyExhibits!.length).toBeLessThanOrEqual(24);
  });
  it('shares real visitor position, selected work, preferences and both-sided conversation with tour requests', () => {
    const selected = { ...exhibit, id: 'selected', position: [20, 1, 20] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    const payload = buildVisitorAwareRequest({
      question: 'How does this compare?', agent: { ...defaultAgentState, preferredLanguage: 'en', personality: 'expert' },
      items: [selected], position: [1, 2, 3], viewingId: selected.id,
      chat: [{ id: 'a', role: 'assistant', content: 'Earlier we discussed light.', createdAt: 0 }],
    });
    expect(payload.exhibit?.id).toBe('selected');
    expect(payload.visitorState).toMatchObject({ currentPosition: [1, 2, 3], preferredLanguage: 'en' });
    expect(payload.userPreferences?.answerLength).toBe('deep');
    expect(payload.chatHistory?.[0].role).toBe('assistant');
  });
  it("includes guided tour progress including currentExhibitId and completedExhibitIds when provided", () => {
    const sessionState = {
      sessionId: "session-1",
      tourProgress: {
        currentStopIndex: 1,
        totalStops: 3,
        currentExhibitId: "painting-1",
        completedExhibitIds: ["intro-1"],
      },
    };

    const request = buildAgentReplyRequest({
      question: "Where should I go next?",
      personality: "expert",
      exhibit,
      sessionState,
    });

    expect(request.sessionState).toBe(sessionState);
    expect(request.sessionState?.tourProgress).toEqual({
      currentStopIndex: 1,
      totalStops: 3,
      currentExhibitId: "painting-1",
      completedExhibitIds: ["intro-1"],
    });
  });

  it("passes visitorState and userPreferences through unchanged", () => {
    const visitorState: AgentVisitorStatePayload = {
      currentPosition: [1, 1.6, -3],
      currentRoomId: "gallery-a",
      mode: "tour",
      followUser: true,
      viewingExhibitId: "painting-1",
      visitedExhibitIds: ["painting-0"],
      engagedExhibitIds: ["painting-1"],
      dwellSecondsByExhibit: { "painting-1": 42 },
    };
    const userPreferences: AgentUserPreferencesPayload = {
      answerLength: "medium",
      guideStyle: "story",
    };

    const request = buildAgentReplyRequest({
      question: "Tell me about this.",
      personality: "xiaobai",
      exhibit,
      visitorState,
      userPreferences,
    });

    expect(request.visitorState).toBe(visitorState);
    expect(request.userPreferences).toBe(userPreferences);
  });
});

describe("getAgentSceneExhibits", () => {
  it("selects the closest eight exhibits independently of insertion order", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      ...exhibit,
      id: `painting-${index}`,
      position: [10 - index, 0, 0] as [number, number, number],
    }));

    expect(getAgentSceneExhibits(items, [0, 0, 0]).map((item) => item.id)).toEqual([
      "painting-9",
      "painting-8",
      "painting-7",
      "painting-6",
      "painting-5",
      "painting-4",
      "painting-3",
      "painting-2",
    ]);
  });

  it("uses horizontal gallery distance instead of exhibit mounting height", () => {
    const highWallWork = {
      ...exhibit,
      id: "high-wall-work",
      position: [1, 8, 0] as [number, number, number],
    };
    const fartherFloorWork = {
      ...exhibit,
      id: "farther-floor-work",
      position: [2, 0, 0] as [number, number, number],
    };

    expect(getAgentSceneExhibits([fartherFloorWork, highWallWork], [0, 0, 0]).map((item) => item.id)).toEqual([
      "high-wall-work",
      "farther-floor-work",
    ]);
  });
});
