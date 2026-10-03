import type { StateCreator } from "zustand";
import type { AppState } from "./useMetaverseStudioStore";

export type MetaverseStoreState = AppState;
export type MetaverseStoreSlice<T> = StateCreator<MetaverseStoreState, [], [], T>;
