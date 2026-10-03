import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../store';
import MetaverseStudioApp from './MetaverseStudioApp';
import { I18nProvider } from '@/app/components/I18nProvider';

vi.mock('../../../modules/metaverse3d/components/CanvasScene', () => ({ CanvasScene: () => <div data-testid="scene" /> }));
vi.mock('../../../modules/metaverse3d/components/MobileControls', () => ({ MobileControls: () => <div data-testid="mobile-controls" /> }));
vi.mock('../canvas/useScenePreloader', () => ({ useScenePreloader: () => ({ backgroundComplete: true, shouldPreloadScene: false }) }));
vi.mock('../../../modules/metaverse3d/components/Multiplayer/MultiplayerBridge', () => ({ MultiplayerBridge: () => null }));
vi.mock('../../../modules/metaverse3d/components/UI/ViewUI', () => ({ ViewUI: () => null }));
vi.mock('../../../modules/metaverse3d/components/UI/EditUI', () => ({ EditUI: () => null }));
vi.mock('../../../modules/metaverse3d/components/UI/AgentModeSelector', () => ({ AgentModeSelector: () => <div data-testid="mode-selector" /> }));
vi.mock('../../../modules/metaverse3d/components/UI/AgentChatPanel', () => ({ AgentChatPanel: () => <div data-testid="agent-chat" /> }));

const initial = useStore.getState();
const renderStudio = (withRouter = false) => {
  localStorage.setItem('metaexpo-locale', 'zh-TW');
  const studio = withRouter ? <MemoryRouter><MetaverseStudioApp /></MemoryRouter> : <MetaverseStudioApp />;
  return render(<I18nProvider>{studio}</I18nProvider>);
};
beforeEach(() => {
  localStorage.setItem('metaexpo-locale', 'zh-TW');
  useStore.setState({ ...initial, mode: 'view', hasSelectedParticipationMode: false }, true);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); useStore.setState(initial, true); });

describe('real studio shell and canvas integration', () => {
  it('lets touch visitors reopen AI chat after closing it without a keyboard', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    useStore.setState({ hasSelectedParticipationMode: true, allowPointerLock: true });
    useStore.getState().setAgent({ participationMode: 'ai', isChatOpen: false });
    renderStudio(true);
    fireEvent.click(screen.getByRole('button', { name: '智慧導覽 Agent' }));
    expect(screen.getByTestId('agent-chat')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-controls')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '智慧導覽 Agent' })).not.toBeInTheDocument();
    act(() => useStore.getState().setAgent({ isChatOpen: false }));
    expect(screen.getByRole('button', { name: '智慧導覽 Agent' })).toBeInTheDocument();
    expect(screen.getByTestId('mobile-controls')).toBeInTheDocument();
    act(() => useStore.setState({ viewingItem: initial.items[0] }));
    expect(screen.queryByRole('button', { name: '智慧導覽 Agent' })).not.toBeInTheDocument();
  });

  it('does not show the AI launcher during solo viewing', () => {
    useStore.setState({ hasSelectedParticipationMode: true, allowPointerLock: true });
    useStore.getState().setAgent({ participationMode: 'solo', isChatOpen: false });
    renderStudio(true);
    expect(screen.queryByRole('button', { name: '智慧導覽 Agent' })).not.toBeInTheDocument();
  });

  it.each(['edit', 'floor-plan'] as const)('blocks a stale mobile %s state before rendering its canvas', (mode) => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    useStore.setState({ mode });
    renderStudio(true);
    expect(screen.getByRole('heading', { name: '請使用電腦編輯展覽' })).toBeInTheDocument();
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '唯讀觀展' }));
    expect(useStore.getState().mode).toBe('view');
    expect(screen.getByTestId('scene')).toBeInTheDocument();
  });

  it('keeps mobile viewing available while rejecting attempts to switch to editing', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    useStore.setState({ hasSelectedParticipationMode: true, allowPointerLock: true });
    renderStudio(true);
    act(() => useStore.getState().setMode('edit'));
    expect(useStore.getState().mode).toBe('view');
    expect(screen.getByTestId('mobile-controls')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '請使用電腦編輯展覽' })).not.toBeInTheDocument();
  });
  it('hides mobile controls until selection and while chat or artwork details are open', () => {
    renderStudio();
    expect(screen.queryByTestId('mobile-controls')).not.toBeInTheDocument();
    act(() => useStore.setState({ hasSelectedParticipationMode: true, allowPointerLock: true }));
    expect(screen.getByTestId('mobile-controls')).toBeInTheDocument();
    act(() => useStore.getState().setAgent({ participationMode: 'ai', isChatOpen: true }));
    expect(screen.queryByTestId('mobile-controls')).not.toBeInTheDocument();
    act(() => {
      useStore.getState().setAgent({ isChatOpen: false });
      useStore.setState({ viewingItem: initial.items[0] });
    });
    expect(screen.queryByTestId('mobile-controls')).not.toBeInTheDocument();
    act(() => useStore.setState({ viewingItem: null }));
    expect(screen.getByTestId('mobile-controls')).toBeInTheDocument();
  });
  it('mounts exactly one mode selector, then exactly one AI panel', () => {
    renderStudio();
    expect(screen.getAllByTestId('mode-selector')).toHaveLength(1);
    act(() => {
      useStore.getState().setHasSelectedParticipationMode(true);
      useStore.getState().setAgent({ participationMode: 'ai', isChatOpen: true });
    });
    expect(screen.queryByTestId('mode-selector')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('agent-chat')).toHaveLength(1);
    act(() => useStore.getState().setMode('edit'));
    expect(screen.queryByTestId('agent-chat')).not.toBeInTheDocument();
  });
});
