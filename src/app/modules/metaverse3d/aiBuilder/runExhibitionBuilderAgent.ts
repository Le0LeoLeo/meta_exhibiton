import type {
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
      review: BuilderReviewResponse["review"];
      prompt?: string;
      revisionCount?: number;
    },
  ) => Promise<BuilderSessionResponse>;
  captureScreenshots: (options: { roomSize: SceneSnapshot["roomSize"] }) => Promise<BuilderScreenshot[]>;
  onStep?: (step: { phase: "generated" | "reviewed" | "revised"; session?: BuilderSessionResponse; review?: BuilderReviewResponse }) => void;
};

export async function runExhibitionBuilderAgent(options: RunBuilderAgentOptions) {
  const maxRevisions = options.maxRevisions ?? 3;
  let session = await options.requestBuilderSession(options.token, options.input);
  options.onStep?.({ phase: "generated", session });

  for (let revisionAttempt = 0; revisionAttempt <= maxRevisions; revisionAttempt += 1) {
    const originalScene = options.exportScene();
    let screenshots: BuilderScreenshot[];
    try {
      options.importScene(session.scene);
      screenshots = await options.captureScreenshots({ roomSize: session.scene.roomSize });
    } finally {
      options.importScene(originalScene);
    }

    const review = await options.requestBuilderReview(options.token, {
      sessionId: session.sessionId,
      versionId: session.versionId,
      scene: session.scene,
      screenshots,
    });
    options.onStep?.({ phase: "reviewed", session, review });

    if (review.review.overallStatus === "pass" || revisionAttempt >= maxRevisions) {
      return { session, review, revisionAttempt };
    }

    session = await options.requestBuilderRevision(options.token, {
      sessionId: session.sessionId,
      versionId: session.versionId,
      scene: session.scene,
      review: review.review,
      prompt: options.input.prompt,
      revisionCount: session.revisionCount ?? revisionAttempt,
    });
    options.onStep?.({ phase: "revised", session, review });
  }

  throw new Error("AI exhibition builder agent stopped unexpectedly");
}
