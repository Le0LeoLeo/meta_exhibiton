import * as THREE from "three";

export const AGENT_SPEED =4;
export const AGENT_STOP_DISTANCE = 2.1;
export const AGENT_FOLLOW_COMFORT_DISTANCE = 1.35;
export const AGENT_GUIDE_TRIGGER_DISTANCE = 3.25;
export const AGENT_GUIDE_STOP_DISTANCE = 1.5;
export const AGENT_CHAT_DISTANCE = 4.8;
export const AGENT_WANDER_POINT_REACHED = 0.7;
export const AGENT_GROUND_Y = 0.15;
export const GUIDE_COOLDOWN_MS = 12000;
export const GUIDE_SPEECH_RATE = 1.02;
export const GUIDE_SPEECH_PITCH = 1;
export const AGENT_TOUR_STOP_DISTANCE = 1.15;

export function shouldPreserveMode(currentMode: string, nextMode: string) {
  return currentMode === nextMode;
}

export function resolveAgentStep(current: THREE.Vector3, target: THREE.Vector3, step: number) {
  const next = current.clone().lerp(target, Math.min(1, step / Math.max(current.distanceTo(target), 0.0001)));
  const snapped = new THREE.Vector3(
    Math.abs(next.x - target.x) < 0.01 ? target.x : next.x,
    AGENT_GROUND_Y,
    Math.abs(next.z - target.z) < 0.01 ? target.z : next.z,
  );
  return { position: snapped, blocked: false };
}

export function speakGuide(text: string, personality: "xiaobai" | "expert" | "humor") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = personality === "humor" ? 1.08 : GUIDE_SPEECH_RATE;
  utterance.pitch = personality === "xiaobai" ? 1.08 : GUIDE_SPEECH_PITCH;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find((voice) => /zh[-_]TW|Chinese|Taiwan/i.test(`${voice.lang} ${voice.name}`));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}
