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
  initialSession?: BuilderSessionResponse;
  maxRevisions?: number;
  signal?: AbortSignal;
  requestBuilderSession: (
    token: string,
    input: ExhibitionSceneRequest,
    signal?: AbortSignal,
  ) => Promise<BuilderSessionResponse>;
  requestBuilderReview: (
    token: string,
    payload: {
      sessionId: string;
      versionId: string;
      scene: SceneSnapshot;
      screenshots: BuilderScreenshot[];
    },
    signal?: AbortSignal,
  ) => Promise<BuilderReviewResponse>;
  requestBuilderRevision: (
    token: string,
    payload: {
      sessionId: string;
      versionId: string;
      scene: SceneSnapshot;
      review: BuilderReview;
      input: ExhibitionSceneRequest;
      prompt?: string;
      revisionCount?: number;
    },
    signal?: AbortSignal,
  ) => Promise<BuilderSessionResponse>;
  captureScreenshots: (options: { scene: SceneSnapshot }) => Promise<BuilderScreenshot[]>;
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
  | "quality_regression"
  | "manual_required"
  | "generation_failed"
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

export type BuilderReviewChange = "improved" | "no_improvement" | "regressed";

const MINIMUM_SCORE_IMPROVEMENT = 3;
const MAXIMUM_SCORE_NOISE = 2;

export function classifyBuilderReviewChange(
  previous: BuilderReview,
  next: BuilderReview,
): BuilderReviewChange {
  const previousHigh = previous.blockingIssues.filter((issue) => issue.severity === "high").length;
  const nextHigh = next.blockingIssues.filter((issue) => issue.severity === "high").length;
  const technicalDelta = next.technicalScore - previous.technicalScore;
  const curatorialDelta = next.curatorialScore - previous.curatorialScore;

  if (
    nextHigh > previousHigh
    || next.blockingIssues.filter((issue) => issue.resolution === "manual").length
      > previous.blockingIssues.filter((issue) => issue.resolution === "manual").length
    || technicalDelta < -MAXIMUM_SCORE_NOISE
    || curatorialDelta < -MAXIMUM_SCORE_NOISE
  ) {
    return "regressed";
  }

  if (
    nextHigh < previousHigh
    || technicalDelta >= MINIMUM_SCORE_IMPROVEMENT
    || curatorialDelta >= MINIMUM_SCORE_IMPROVEMENT
  ) {
    return "improved";
  }

  return "no_improvement";
}

export function didReviewImprove(previous: BuilderReview, next: BuilderReview) {
  return classifyBuilderReviewChange(previous, next) === "improved";
}

function throwIfCancelled(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw new DOMException("Builder agent run was cancelled.", "AbortError");
}

export async function runExhibitionBuilderAgent(options: RunBuilderAgentOptions) {
  const requestedRevisions = Math.min(3, Math.max(0, options.maxRevisions ?? 3));
  const remainingRevisions = Math.max(0, 3 - (options.initialSession?.revisionCount ?? 0));
  const maxRevisions = Math.min(requestedRevisions, remainingRevisions);
  throwIfCancelled(options.signal);
  let session = options.initialSession;
  if (!session) {
    options.onStep?.({ phase: "generating", attempt: 0, maxRevisions });
    session = await options.requestBuilderSession(options.token, options.input, options.signal);
    throwIfCancelled(options.signal);
  }
  let previousReview: BuilderReview | null = null;
  let bestSession: BuilderSessionResponse | null = null;

  for (let revisionAttempt = 0; revisionAttempt <= maxRevisions; revisionAttempt += 1) {
    if (session.source === "fallback") {
      const review: BuilderReviewResponse = {
        sessionId: session.sessionId, versionId: session.versionId,
        status: "unavailable", source: "fallback", review: null,
        message: "The planning model was unavailable. The draft is preserved; retry generation before visual review.",
      };
      options.onStep?.({ phase: "stopped", attempt: revisionAttempt, maxRevisions, session, review, message: review.message });
      return { session, review, bestSession, revisionAttempt, stopReason: session.appliedOperationCount === 0 ? "generation_failed" as const : "review_unavailable" as const };
    }
    options.onStep?.({ phase: "capturing", attempt: revisionAttempt, maxRevisions, session });
    let screenshots: BuilderScreenshot[];
    try {
      screenshots = await options.captureScreenshots({ scene: session.scene });
    } catch (error) {
      throwIfCancelled(options.signal);
      const review: BuilderReviewResponse = {
        sessionId: session.sessionId, versionId: session.versionId,
        review: null, status: "unavailable", source: "fallback",
        errorCode: "INVALID_INSPECTION_VIEWS",
        message: error instanceof Error ? error.message : "Inspection capture failed.",
      };
      options.onStep?.({ phase: "stopped", attempt: revisionAttempt, maxRevisions, session, review, message: review.message });
      return { session, review, bestSession, revisionAttempt, stopReason: "review_unavailable" as const };
    }
    throwIfCancelled(options.signal);

    options.onStep?.({ phase: "reviewing", attempt: revisionAttempt, maxRevisions, session });
    const review = await options.requestBuilderReview(options.token, {
      sessionId: session.sessionId,
      versionId: session.versionId,
      scene: session.scene,
      screenshots,
    }, options.signal);
    throwIfCancelled(options.signal);
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
      return { session, review, bestSession, revisionAttempt, stopReason: "review_unavailable" as const };
    }

    if (previousReview) {
      const reviewChange = classifyBuilderReviewChange(previousReview, review.review);
      if (reviewChange === "regressed" || (reviewChange === "no_improvement" && review.review.overallStatus !== "pass")) {
        options.onStep?.({ phase: "stopped", attempt: revisionAttempt, maxRevisions, session, review, scores });
        return {
          session,
          review,
          bestSession,
          revisionAttempt,
          stopReason: reviewChange === "regressed"
            ? "quality_regression" as const
            : "no_improvement" as const,
        };
      }
    }

    bestSession = session;

    const hasManualIssues = review.review.blockingIssues.some((issue) => issue.resolution === "manual");
    const hasAutomaticIssues = review.review.blockingIssues.some((issue) => issue.resolution !== "manual");
    if (hasManualIssues && !hasAutomaticIssues) {
      options.onStep?.({ phase: "stopped", attempt: revisionAttempt, maxRevisions, session, review, scores });
      return { session, review, bestSession, revisionAttempt, stopReason: "manual_required" as const };
    }

    if (review.review.overallStatus === "pass") {
      options.onStep?.({ phase: "completed", attempt: revisionAttempt, maxRevisions, session, review, scores });
      return { session, review, bestSession, revisionAttempt, stopReason: "passed" as const };
    }

    if (revisionAttempt >= maxRevisions) {
      options.onStep?.({ phase: "stopped", attempt: revisionAttempt, maxRevisions, session, review, scores });
      return { session, review, bestSession, revisionAttempt, stopReason: hasManualIssues ? "manual_required" as const : "revision_limit" as const };
    }

    previousReview = review.review;
    options.onStep?.({ phase: "revising", attempt: revisionAttempt + 1, maxRevisions, session, review, scores });
    session = await options.requestBuilderRevision(options.token, {
      sessionId: session.sessionId,
      versionId: session.versionId,
      scene: session.scene,
      review: review.review,
      input: options.input,
      prompt: options.input.prompt,
      revisionCount: session.revisionCount ?? revisionAttempt,
    }, options.signal);
    throwIfCancelled(options.signal);
  }

  throw new Error("AI exhibition builder agent stopped unexpectedly");
}
