import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GallerySummary } from '../api/gallery';
import { ExhibitionShareDialog } from './ExhibitionShareDialog';
import { generateExhibitionQr } from './exhibitionQr';

vi.mock('./I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('./exhibitionQr', () => ({ generateExhibitionQr: vi.fn() }));
const gallery = { id: 'gallery/one', title: 'My exhibition', isPublished: true } as GallerySummary;
const png = 'data:image/png;base64,qr-image';
const writeText = vi.fn().mockResolvedValue(undefined);
const onOpenChange = vi.fn();
const mount = (value = gallery) => render(<ExhibitionShareDialog gallery={value} open onOpenChange={onOpenChange} />);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateExhibitionQr).mockResolvedValue(png);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(cleanup);

describe('ExhibitionShareDialog', () => {
  it('copies the same public visitor URL encoded in the QR and downloads the displayed PNG', async () => {
    mount();
    const url = `${window.location.origin}/exhibitions/gallery%2Fone`;
    expect(await screen.findByRole('img', { name: 'shareQrImageAlt' })).toHaveAttribute('src', png);
    expect(generateExhibitionQr).toHaveBeenCalledWith(url);
    expect(screen.getByRole('textbox', { name: 'shareQrVisitorLink' })).toHaveValue(url);
    fireEvent.click(screen.getByRole('button', { name: 'shareQrCopy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    const download = screen.getByRole('link', { name: 'shareQrDownload' });
    expect(download).toHaveAttribute('href', png);
    expect(download).toHaveAttribute('download', 'My exhibition-QR.png');
  });

  it('does not expose a public QR or link for an unpublished exhibition', async () => {
    mount({ ...gallery, isPublished: false });
    expect(screen.getByRole('status')).toHaveTextContent('shareQrPublishFirst');
    expect(generateExhibitionQr).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps the link available after QR generation fails and supports retry', async () => {
    vi.mocked(generateExhibitionQr).mockRejectedValueOnce(new Error('QR failed'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('shareQrError');
    expect(screen.getByRole('button', { name: 'shareQrDownload' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'shareQrCopy' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'shareQrRetry' }));
    expect(await screen.findByRole('img')).toHaveAttribute('src', png);
  });

  it('discards a previous gallery QR result when the selected gallery changes', async () => {
    let resolveFirst!: (value: string) => void;
    vi.mocked(generateExhibitionQr).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    const view = mount();
    expect(screen.getByRole('status')).toHaveTextContent('shareQrLoading');
    const next = { ...gallery, id: 'second', title: 'Second' };
    view.rerender(<ExhibitionShareDialog gallery={next} open onOpenChange={onOpenChange} />);
    await screen.findByRole('img');
    await act(async () => resolveFirst('data:image/png;base64,wrong-gallery'));
    expect(screen.getByRole('img')).toHaveAttribute('src', png);
    expect(screen.getByRole('textbox')).toHaveValue(`${window.location.origin}/exhibitions/second`);
  });

  it('does not generate QR codes while closed and sanitizes the downloaded filename', async () => {
    const view = render(<ExhibitionShareDialog gallery={gallery} open={false} onOpenChange={onOpenChange} />);
    expect(generateExhibitionQr).not.toHaveBeenCalled();
    view.rerender(<ExhibitionShareDialog gallery={{ ...gallery, title: 'Show/<script>?' }} open onOpenChange={onOpenChange} />);
    const link = await screen.findByRole('link', { name: 'shareQrDownload' });
    expect(link).toHaveAttribute('download', 'Show--script---QR.png');
    fireEvent.click(screen.getByRole('button', { name: 'close', exact: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
