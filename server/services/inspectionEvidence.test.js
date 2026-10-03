import { describe, expect, it } from 'vitest';
import { validateInspectionEvidence } from './inspectionEvidence.js';
import { inspectionTestImage } from './__fixtures__/inspectionImages.js';

describe('inspection evidence', () => {
  it('rejects distinct flat images as well as corrupt PNGs', async () => {
    const screenshots = await Promise.all([0, 1, 2].map(async (seed) => ({viewId: `view-${seed}`, dataUrl: await inspectionTestImage(seed, true)})));
    screenshots.push({viewId: 'broken', dataUrl: 'data:image/png;base64,aaa'});
    const result = await validateInspectionEvidence(screenshots);
    expect(result.valid).toHaveLength(0);
    expect(result.rejected).toHaveLength(4);
  });

  it('keeps varied evidence but rejects repeated decoded pixels', async () => {
    const screenshots = await Promise.all([0, 1, 2, 0].map(async (seed, i) => ({viewId: `view-${i}`, dataUrl: await inspectionTestImage(seed)})));
    const result = await validateInspectionEvidence(screenshots);
    expect(result.valid).toHaveLength(3);
    expect(result.rejected).toEqual(['view-3']);
  });
});
