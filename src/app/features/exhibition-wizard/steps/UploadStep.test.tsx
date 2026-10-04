import { cleanup, fireEvent, render as baseRender, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExhibitionWizardDraft } from '../wizardStore';
import { UploadStep } from './UploadStep';
import { I18nProvider } from '@/app/components/I18nProvider';

const render = (ui: ReactElement) => baseRender(ui, { wrapper: I18nProvider });

const deleteMediaAsset = vi.fn();
vi.mock('@/app/api/media', () => ({
  uploadMediaAsset: vi.fn(),
  deleteMediaAsset: (...args: unknown[]) => deleteMediaAsset(...args),
}));

describe('UploadStep media removal', () => {
  beforeEach(() => { deleteMediaAsset.mockReset(); localStorage.setItem('metaexpo-locale', 'zh-TW'); });
  afterEach(() => { cleanup(); localStorage.clear(); });

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

  it.each([
    ['en', 'Upload artworks', 'Uploaded', 'Sign in to upload artworks', 'Import student artwork details'],
    ['zh-TW', '上傳作品', '已上傳', '登入後上傳作品', '匯入學生作品資料'],
    ['zh-CN', '上传作品', '已上传', '登录后上传作品', '导入学生作品数据'],
  ])('uses the selected locale throughout the upload step (%s)', (locale, label, status, signIn, importTitle) => {
    localStorage.setItem('metaexpo-locale', locale);
    const onRequireAuth = vi.fn();
    render(<UploadStep draft={{ ...createExhibitionWizardDraft(), assets: [{ id: 'asset', fileName: 'work.jpg', status: 'succeeded' }] }} patch={vi.fn()} token={null} onRequireAuth={onRequireAuth} />);
    expect(screen.getByLabelText(label)).toHaveAttribute('type', 'file');
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(screen.getByText(importTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: signIn }));
    expect(onRequireAuth).toHaveBeenCalledOnce();
  });

});
