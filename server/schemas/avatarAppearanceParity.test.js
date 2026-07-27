import { describe, expect, it } from 'vitest';
import { AVATAR_MANIFEST } from '../../src/app/modules/metaverse3d/avatar/avatarManifest.ts';
import { REQUIRED_NODES } from '../../scripts/validate-avatar-kit.mjs';
import { avatarAppearanceSchema } from './avatarAppearanceSchema.js';

function sorted(values) {
  return [...values].sort();
}

describe('avatar contract parity', () => {
  it('keeps frontend manifest IDs aligned with the server allowlist', () => {
    for (const [category, entries] of Object.entries(AVATAR_MANIFEST.nodes)) {
      expect(
        sorted(avatarAppearanceSchema.shape[category].options),
        `server ${category} options`,
      ).toEqual(sorted(Object.keys(entries)));
    }
    for (const [category, entries] of Object.entries(AVATAR_MANIFEST.colors)) {
      expect(
        sorted(avatarAppearanceSchema.shape.colors.shape[category].options),
        `server ${category} color options`,
      ).toEqual(sorted(Object.keys(entries)));
    }
  });

  it('requires every frontend mesh node in the GLB validator', () => {
    const required = new Set(REQUIRED_NODES);
    for (const entries of Object.values(AVATAR_MANIFEST.nodes)) {
      for (const nodeName of Object.values(entries)) {
        expect(required.has(nodeName), nodeName).toBe(true);
      }
    }
  });
});
