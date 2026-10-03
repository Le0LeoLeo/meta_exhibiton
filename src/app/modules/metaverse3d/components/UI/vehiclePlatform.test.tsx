import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorLeftToolbar } from './EditorLeftToolbar';
import { PedestalInspector } from './PedestalInspector';
import { useItemPlacement } from './useItemPlacement';
import { defaultGalleryScene } from '../../store/defaultGalleryScene';
import { VEHICLE_PLATFORM_URL } from '../../items/templateDisplay';
import type { ExhibitItem } from '../../types';
import { I18nProvider } from '../../../../components/I18nProvider';

const renderZhTw = (ui: React.ReactNode) => {
  localStorage.setItem('metaexpo-locale', 'zh-TW');
  return render(<I18nProvider>{ui}</I18nProvider>);
};
afterEach(() => { cleanup(); localStorage.clear(); });

describe('rectangular platform editor tool', () => {
  it('starts pending placement with the standalone platform while keeping ordinary pedestals unchanged', () => {
    const setPendingPlacement = vi.fn();
    const clearSelection = vi.fn();
    function Toolbar() {
      const { handleAddItem } = useItemPlacement({
        roomSize: defaultGalleryScene.roomSize,
        selectedWallFace: null, selectedWallSegmentId: null, items: [],
        spawnLocation: 'center', wallBatchCount: 1, wallBatchSpacing: 2,
        partitionAttachSide: 'front', autoAddTopLightstrip: true,
        setPendingPlacement, setWallBatchCount: vi.fn(), clearSelection,
      });
      return <EditorLeftToolbar glassPanelClass="" isModelLibraryOpen={false} setIsModelLibraryOpen={vi.fn()} handleAddItem={handleAddItem} />;
    }
    renderZhTw(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: '長方形展台' }));
    expect(clearSelection).toHaveBeenCalledOnce();
    expect(setPendingPlacement).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'pedestal', position: [0, 0, 0], rotation: [0, 0, 0], autoTopLightstrip: false,
      itemDefaults: { content: VEHICLE_PLATFORM_URL, title: '長方形展台', modelOffset: [0, 0, 0], scale: [1, 1, 1] },
    }));
    fireEvent.click(screen.getByRole('button', { name: '展台', exact: true }));
    expect(setPendingPlacement.mock.calls.at(-1)![0].itemDefaults).toBeUndefined();
    expect(setPendingPlacement).toHaveBeenCalledTimes(2);
  });

  it('shows platform dimensions without offering model replacement or model offsets', () => {
    const item: ExhibitItem = { id: 'platform', type: 'pedestal', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: VEHICLE_PLATFORM_URL, modelOffset: [0, 0, 0] };
    const { rerender } = renderZhTw(<PedestalInspector selectedItem={item} glassButtonClass="" updateItem={vi.fn()} />);
    expect(screen.getByText('原始尺寸：5.4 × 2.6 米，高 0.14 米')).toBeInTheDocument();
    expect(screen.queryByLabelText('3D 模型網址')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('editorUploadModel')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('editorModelOffset X')).not.toBeInTheDocument();
    rerender(<I18nProvider><PedestalInspector selectedItem={{ ...item, content: '/models/work.glb' }} glassButtonClass="" updateItem={vi.fn()} /></I18nProvider>);
    expect(screen.getByLabelText('3D 模型網址')).toBeInTheDocument();
    expect(screen.getByLabelText('上傳 3D 模型')).toBeInTheDocument();
    expect(screen.getByLabelText('模型偏移 X')).toBeInTheDocument();
  });
});
