export * from './base';
export * from './auth';
export * from './gallery';
export * from './competition';
export * from './growth';
export * from './agent';
export * from './tts';
export * from './aiWriting';
export * from './exhibitionScene';
export * from './visitorMemory';

function encodeWavSilence(durationSeconds = 0.75, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function generateGuideTts(payload: {
  title?: string;
  artist?: string;
  description?: string;
}): Promise<Blob> {
  const parts = [payload.title, payload.artist, payload.description].map((part) => (part ?? '').trim()).filter(Boolean);
  if (parts.length === 0) {
    return encodeWavSilence();
  }

  const speechText = `展品導覽。${parts.join('。')}`;

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return encodeWavSilence(Math.min(1.25, 0.45 + speechText.length / 60));
  }

  return encodeWavSilence();
}
