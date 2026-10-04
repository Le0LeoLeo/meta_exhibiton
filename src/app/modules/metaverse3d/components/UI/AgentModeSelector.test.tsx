import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../store/useStore';
import { AgentModeSelector } from './AgentModeSelector';

vi.mock('../../../../components/I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en' }) }));
const initial = useStore.getState();
beforeEach(() => useStore.setState({ ...initial, agent: { ...initial.agent, participationMode: 'solo' }, hasSelectedParticipationMode: false, allowPointerLock: false }, true));
afterEach(() => { cleanup(); useStore.setState(initial, true); });

describe('exhibition entry', () => {
  it('requests landscape during the entry gesture before selecting participation', () => {
    const onEnter = vi.fn(() => expect(useStore.getState().hasSelectedParticipationMode).toBe(false));
    render(<AgentModeSelector onEnter={onEnter} landscapeOnEnter />);
    expect(screen.getByText('viewLandscapeOnEnter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'agentConfirmAria' }));
    expect(onEnter).toHaveBeenCalledOnce();
    expect(useStore.getState().hasSelectedParticipationMode).toBe(true);
  });
  it('lets the visitor enter directly with the highlighted solo choice', () => {
    render(<AgentModeSelector />);
    expect(screen.getByRole('button', { name: 'agentModeSoloAria' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('agentAppearanceTitle')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'agentConfirmAria' }));
    expect(useStore.getState()).toMatchObject({ hasSelectedParticipationMode: true, allowPointerLock: true, agent: { participationMode: 'solo', isChatOpen: false } });
  });
  it('shows guide choices only for AI and opens its chat after confirmation', () => {
    useStore.getState().setAgent({ preferredLanguage: 'zh-TW' });
    render(<AgentModeSelector />);
    fireEvent.click(screen.getByRole('button', { name: 'agentModeAiAria' }));
    expect(screen.getByRole('button', { name: 'agentModeSoloAria' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('agentAppearanceTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'agentConfirmAria' }));
    expect(useStore.getState()).toMatchObject({ hasSelectedParticipationMode: true, agent: { participationMode: 'ai', enabled: true, isChatOpen: true, preferredLanguage: 'en' } });
  });
});
