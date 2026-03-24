import { create } from "zustand";
import type { Vec3 } from "./protocol";

type LocalPlayerState = {
  position: Vec3;
  yaw: number;
  setTransform: (position: Vec3, yaw: number) => void;
};

export const useLocalPlayerStore = create<LocalPlayerState>((set) => ({
  position: { x: 0, y: 2.6, z: 5 },
  yaw: 0,
  setTransform: (position, yaw) => set({ position, yaw }),
}));
