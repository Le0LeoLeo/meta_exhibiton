import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBuilderChat } from './useBuilderChat';
const auth = vi.hoisted(() => ({ user: { id: 'owner' } }));
vi.mock('../../../../api/client', () => ({ loadAuth: () => auth }));
beforeEach(() => { localStorage.clear(); auth.user.id = 'owner'; window.history.replaceState(null, '', '/?gallery=one'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('persists multiple conversations and execution records across remounts', () => {
  const first = renderHook(() => useBuilderChat());
  act(() => first.result.current.append({ role: 'user', text: 'Build a room' }));
  const id = first.result.current.activeId!;
  act(() => first.result.current.append({ role: 'assistant', text: 'Draft ready', steps: ['Checked geometry'], sessionId: 's1', versionId: 'v1' }));
  act(() => first.result.current.select(null));
  act(() => first.result.current.append({ role: 'user', text: 'Another exhibition' }));
  first.unmount();
  const second = renderHook(() => useBuilderChat());
  expect(second.result.current.chats).toHaveLength(2);
  act(() => second.result.current.select(id));
  expect(second.result.current.messages.map(message => message.text)).toEqual(['Build a room', 'Draft ready']);
  expect(second.result.current.messages[1]).toMatchObject({ steps: ['Checked geometry'], sessionId: 's1', versionId: 'v1' });
});
it('does not expose history in another account or exhibition', () => {
  const first = renderHook(() => useBuilderChat());
  act(() => first.result.current.append({ role: 'user', text: 'Private brief' })); first.unmount();
  auth.user.id = 'other';
  const second = renderHook(() => useBuilderChat()); expect(second.result.current.chats).toEqual([]); second.unmount();
  auth.user.id = 'owner'; window.history.replaceState(null, '', '/?gallery=two');
  expect(renderHook(() => useBuilderChat()).result.current.chats).toEqual([]);
});
it('keeps a usable transcript when browser storage is full', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const { result } = renderHook(() => useBuilderChat());
  act(() => result.current.append({ role: 'user', text: 'Keep this text' }));
  expect(result.current.storageFailed).toBe(true);
  expect(result.current.messages[0].text).toBe('Keep this text');
});
it('ignores malformed stored messages', () => {
  localStorage.setItem('builder-chats:v1:owner:/?gallery=one', JSON.stringify([{ id: 'broken', title: 'Bad record', messages: [null] }]));
  expect(renderHook(() => useBuilderChat()).result.current.chats).toEqual([]);
});
