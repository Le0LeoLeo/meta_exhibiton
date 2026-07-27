import type {
  BuilderReview,
  BuilderReviewResponse,
  BuilderScreenshot,
  BuilderSessionResponse,
  ExhibitionSceneRequest,
} from "../../../api/exhibitionScene";
import type { SceneSnapshot } from "../store/metaverseStoreTypes";

type RunBuilderAgentOptions = {
  token: string;
  input: ExhibitionSceneRequest;
  maxRevisions?: number;
  exportScene: () => SceneSnapshot;
  importScene: (scene: SceneSnapshot) => void;
  requestBuilderSession: (token: string, input: ExhibitionSceneRequest) => Promise<BuilderSessionResponse>;
  requestBuilderReview: (
    token: string,
    payload: {
      sessionId: string;
      versionId: string;
      scene: SceneSnapshot;
      screenshots: BuilderScreenshot[];
    },
  ) => Promise<BuilderReviewResponse>;
  requestBuilderRevision: (
    token: string,
    payload: {
      sessionId: string;
      versionId: string;
      scene: SceneSnapshot;
      review: BuilderReview;
      prompt?: string;
      revisionCount?: number;
    },
  ) => Promise<BuilderSessionResponse>;
  captureScreenshots: (options: { roomSize: SceneSnapshot["roomSize"] }) => Promise<BuilderScreenshot[]>;
  onStep?: (step: BuilderAgentStep) => void;
};

export type BuilderAgentPhase =
  | "generating"
  | "capturing"
  | "reviewing"
  | "revising"
  | "completed"
  | "stopped";

export type BuilderAgentStopReason =
  | "passed"
  | "revision_limit"
  | "no_improvement"
  | "review_unavailable";

export type BuilderAgentStep = {
  phase: BuilderAgentPhase;
  attempt: number;
  maxRevisions: number;
  session?: BuilderSessionResponse;
  review?: BuilderReviewResponse;
  scores?: { technical: number; curatorial: number };
  message?: string;
};

export function didReviewImprove(previous: BuilderReview, next: BuilderReview) {
  const previousHigh = previous.blockingIssues.filter((issue) => issue.severity === "high").length;
  const nextHigh = next.blockingIssues.filter((issue) => issue.severity === "high").length;
  return nextHigh < previousHigh
    || next.technicalScore >= previous.technicalScore + 3
    || next.curatorialScore >= previous.curatorialScore + 3;
}

export async function runExhibitionBuilderAgent(options: RunBuilderAgentOptions) {
  const maxRevisions = Math.min(3, Math.max(0, options.maxRevisions ?? 3));
  options.onStep?.({ phase: "generating", attempt: 0, maxRevisions });
  let session = await options.requestBuilderSession(options.token, options.input);
  let previousReview: BuilderReview | null = null;

  for (let revisionAttempt = 0; revisionAttempt <= maxRevisions; revisionAttempt += 1) {
    const originalScene = options.exportScene();
    let screenshots: BuilderScreenshot[];
    options.onStep?.({ phase: "capturing", attempt: revisionAttempt, maxRevisions, session });
    try {
      options.importScene(session.scene);
      screenshots = await options.captureScreenshots({ roomSize: session.scene.roomSize });
    } finally {
      options.importScene(originalScene);
    }

    options.onStep?.({ phase: "reviewing", attempt: revisionAttempt, maxRevisions, session });
    const review = await options.requestBuilderReview(options.token, {
      sessionId: session.sessionId,
      versionId: session.versionId,
      scene: session.scene,
      screenshots,
    });
    const scores = review.review
      ? { technical: review.review.technicalScore, curatorial: review.review.curatorialScore }
      : undefined;

    if (review.status === "unavailable" || !review.review) {
      options.onStep?.({
        phase: "stopped",
        attempt: revisionAttempt,
        maxRevisions,
        session,
        review,
        message: review.message,
      });
      return { session, review, revisionAttempt, stopReason: "review_unavailable" as const };
    }

    if (review.review.overallStatus === "pass") {
      options.onStep?.({ phase: "completed", attempt: revisionAttempt, maxRevisions, session, review, scores });
      return { session, review, revisionAttempt, stopReason: "passed" as const };
    }

    if (previousReview && !didReviewImprove(previousReview, review.review)) {
      options.onStep?.({ phase: "stopped", attempt: revisionAttempt, maxRevisions, session, review, scores });
      return { session, review, revisionAttempt, stopReason: "no_improvement" as const };
    }

    if (revisionAttempt >= maxRevisions) {
      options.onStep?.({ phase: "stopped", attempt: revisionAttempt, maxRevisions, session, review, scores });
      return { session, review, revisionAttempt, stopReason: "revision_limit" as const };
    }

    previousReview = review.review;
    options.onStep?.({ phase: "revising", attempt: revisionAttempt + 1, maxRevisions, session, review, scores });
    session = await options.requestBuilderRevision(options.token, {
      sessionId: session.sessionId,
      versionId: session.versionId,
      scene: session.scene,
      review: review.review,
      prompt: options.input.prompt,
      revisionCount: session.revisionCount ?? revisionAttempt,
    });
  }

  throw new Error("AI exhibition builder agent stopped unexpectedly");
}
