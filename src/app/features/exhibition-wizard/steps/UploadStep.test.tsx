import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExhibitionWizardDraft } from '../wizardStore';
import { UploadStep } from './UploadStep';

const deleteMediaAsset = vi.fn();
vi.mock('@/app/api/media', () => ({
  uploadMediaAsset: vi.fn(),
  deleteMediaAsset: (...args: unknown[]) => deleteMediaAsset(...args),
}));

describe('UploadStep media removal', () => {
  beforeEach(() => deleteMediaAsset.mockReset());
  afterEach(cleanup);

  it('deletes persisted media before removing it from the draft', async () => {
    deleteMediaAsset.mockResolvedValue({ cleanupPending: false });
    const patch = vi.fn();
    const draft = { ...createExhibitionWizardDraft(), assets: [{
      id: '11111111-1111-4111-8111-111111111111', fileName: 'work.jpg', status: 'succeeded', url: '/api/media/id',
    }] as const };
    render(<UploadStep draft={draft} patch={patch} token="token" onRequireAuth={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '移除 work.jpg' }));
    await waitFor(() => expect(deleteMediaAsset).toHaveBeenCalledWith('token', draft.assets[0].id));
    expect(patch).toHaveBeenCalledWith({ assets: [] });
  });

});
