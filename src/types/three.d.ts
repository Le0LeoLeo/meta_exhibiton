import type { Interpolant, TypedArray } from "three";

declare module "three" {
  interface KeyframeTrack {
    // Three r181 assigns this factory in setInterpolation; its declarations omit it.
    createInterpolant(result?: TypedArray): Interpolant;
  }
}
