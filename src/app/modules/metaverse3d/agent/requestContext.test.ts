import { describe, expect, it } from "vitest";

import { buildAgentReplyRequest } from "./requestContext";
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
