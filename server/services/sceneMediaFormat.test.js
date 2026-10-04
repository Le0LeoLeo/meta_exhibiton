import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { planSceneMedia } from './sceneMediaFormat.js';
describe('scene media formats', () => {
  it('accepts a recorded video fixture and rejects a WebM header without frames', async () => {
    const video = await readFile('e2e/fixtures/builder-film.webm');
    expect(planSceneMedia(video, 'video/webm', 'film.webm').buffer).toEqual(video);
    expect(() => planSceneMedia(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]), 'video/webm', 'empty.webm')).toThrow();
  });
  it('accepts an actual bundled GLB and preserves its bytes', async () => {
    const buffer = await readFile('public/templates/concept-car.glb');
    const plan = planSceneMedia(buffer, 'application/octet-stream', 'car.glb');
    expect(plan.mimeType).toBe('model/gltf-binary');
    expect(plan.buffer).toBe(buffer);
    expect(plan.metadataSanitized).toBe(false);
  });
  it('accepts embedded glTF and rejects external dependencies or executable content', () => {
    const buffer = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }] }));
    expect(planSceneMedia(buffer, 'model/gltf+json', 'model.gltf').extension).toBe('.gltf');
    expect(() => planSceneMedia(Buffer.from(JSON.stringify({ asset: { version: '2.0' }, images: [{ uri: 'https://unselected.example/private.jpg' }] })), 'model/gltf+json', 'model.gltf')).toThrow(/self-contained/);
    expect(() => planSceneMedia(Buffer.from('<script>bad</script>'), 'model/gltf-binary', 'model.glb')).toThrow();
  });
  it('checks video signatures and MIME agreement', () => {
    const mp4 = Buffer.alloc(32); mp4.writeUInt32BE(24); mp4.write('ftyp', 4); mp4.write('isom', 8);
    expect(planSceneMedia(mp4, 'video/mp4', 'video.mp4').extension).toBe('.mp4');
    expect(() => planSceneMedia(mp4, 'video/webm', 'video.webm')).toThrow();
  });
  it('rejects truncated GLB chunks and permits binary STL with exact length', async () => {
    const glb = await readFile('public/templates/concept-car.glb');
    expect(() => planSceneMedia(glb.subarray(0, glb.length - 1), 'model/gltf-binary', 'model.glb')).toThrow();
    const stl = Buffer.alloc(134); stl.writeUInt32LE(1, 80);
    expect(planSceneMedia(stl, 'model/stl', 'model.stl').extension).toBe('.stl');
  });
});
