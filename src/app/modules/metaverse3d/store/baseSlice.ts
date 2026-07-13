import type { StateCreator } from "zustand";
import type { BaseMetaverseActions, BaseMetaverseState } from "./metaverseStoreTypes";

export type MetaverseStoreState = BaseMetaverseState & BaseMetaverseActions;
export type MetaverseStoreSlice<T> = StateCreator<MetaverseStoreState, [], [], T>;
