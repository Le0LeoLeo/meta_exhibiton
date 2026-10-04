import { describe, expect, it } from 'vitest';
import { defaultAgentState } from '../store/metaverseStoreUtils';
import type { ExhibitItem } from '../types';
import { buildCompanionRoute, dismissCompanionInvitation, observeVisitor, parseCompanionCommand, resolveVisitorFocus } from './companion';
import { toExhibitData } from './behaviorHelpers';

const item = (id: string, x = 0): ExhibitItem => ({ id, title: id, type: 'painting', content: '', position: [x, 1.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });

describe('visitor attention and companion policy', () => {
  it('understands explicit pacing commands without treating artwork questions as commands', () => {
    expect(parseCompanionCommand('請安靜一下。')).toBe('quiet');
    expect(parseCompanionCommand('Please start a tour')).toBe('tour');
    expect(parseCompanionCommand('帶我去下一站')).toBe('next');
    expect(parseCompanionCommand('Resume suggestions')).toBe('resume');
    expect(parseCompanionCommand('Why is this work so quiet?')).toBeNull();
    expect(parseCompanionCommand('介紹「安靜」這件作品')).toBeNull();
  });
  it('uses the explicitly viewed work before proximity, and ignores distant works', () => {
    const items = [item('near', 1), item('selected', 10)];
    expect(resolveVisitorFocus(items, [0, 0, 0], 'selected')?.id).toBe('selected');
    expect(resolveVisitorFocus(items, [0, 0, 0], null)?.id).toBe('near');
    expect(resolveVisitorFocus(items, [30, 0, 0], null)).toBeNull();
  });

  it('keeps all exhibits for sensing and routes, beyond the model context budget', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`work-${i}`, i));
    expect(toExhibitData(items)).toHaveLength(12);
    expect(buildCompanionRoute(items, defaultAgentState.memory, [11, 0, 0])).toHaveLength(12);
    expect(buildCompanionRoute(items, defaultAgentState.memory, [11, 0, 0])[0]).toBe('work-11');
  });

  it('prioritizes unvisited works without dropping revisits from a complete route', () => {
    expect(buildCompanionRoute([item('seen'), item('new', 2)], { ...defaultAgentState.memory, visitedExhibitIds: ['seen'] }, [0, 0, 0])).toEqual(['new', 'seen']);
  });

  it('records actual dwell, marks sustained visits and offers help only after a pause', () => {
    let agent = structuredClone(defaultAgentState);
    for (let i = 1; i <= 8; i++) agent = { ...agent, ...observeVisitor(agent, item('a'), 1, i * 1000, true) };
    expect(agent.memory.dwellSecondsByExhibit.a).toBe(8);
    expect(agent.memory.visitedExhibitIds).toContain('a');
    expect(agent.companion.invitation?.exhibitId).toBe('a');
    expect(agent.companion.promptedExhibitIds).toEqual(['a']);
  });

  it('does not mistake passing by for a visit or count a background-tab time jump', () => {
    const first = observeVisitor(defaultAgentState, item('a'), 1, 1000, true);
    const next = observeVisitor({ ...defaultAgentState, ...first }, item('b'), 120, 121000, true);
    expect(next.memory.visitedExhibitIds).not.toContain('a');
    expect(next.memory.dwellSecondsByExhibit.b).toBeLessThanOrEqual(2);
    expect(next.companion.invitation).toBeNull();
  });

  it('clears an invitation on departure and respects dismissal and quiet mode', () => {
    let agent = structuredClone(defaultAgentState);
    for (let i = 1; i <= 8; i++) agent = { ...agent, ...observeVisitor(agent, item('a'), 1, i * 1000, true) };
    expect(observeVisitor(agent, null, 1, 9000, true).companion.invitation).toBeNull();
    agent.companion = dismissCompanionInvitation(agent.companion, 9000);
    for (let i = 10; i <= 30; i++) agent = { ...agent, ...observeVisitor(agent, item('b'), 1, i * 1000, true) };
    expect(agent.companion.invitation).toBeNull();
    expect(agent.companion.nextPromptAt).toBeGreaterThan(30000);
    agent.companion = { ...agent.companion, proactiveEnabled: false };
    expect(observeVisitor(agent, item('c'), 1, 999999, true).companion.invitation).toBeNull();
  });

  it('never interrupts an active conversation or tour', () => {
    let agent = structuredClone(defaultAgentState);
    for (let i = 1; i <= 15; i++) agent = { ...agent, ...observeVisitor(agent, item('a'), 1, i * 1000, false) };
    expect(agent.memory.dwellSecondsByExhibit.a).toBe(15);
    expect(agent.companion.invitation).toBeNull();
  });
});
