import { describe, expect, it } from 'vitest';
import {
  buildPassportTasks,
  evaluatePassportProgress,
  getEligibleExhibits,
} from './exhibitionPassportRules.js';

describe('exhibition passport rules', () => {
  it.each([[0, false, 0], [1, true, 1], [2, true, 2], [5, true, 3]])(
    'builds stable tasks for %i eligible exhibits',
    (eligibleExhibitCount, available, target) => {
      const result = buildPassportTasks({ eligibleExhibitCount });
      expect(result.available).toBe(available);
      if (available) {
        expect(result.tasks).toEqual([
          { id: 'visit-count', kind: 'visit-count', target },
          { id: 'dwell-one', kind: 'dwell-one', targetSeconds: 20 },
          { id: 'engage-count', kind: 'engage-count', target: 1 },
        ]);
      } else expect(result.tasks).toEqual([]);
    },
  );

  it('filters and normalizes eligible scene items', () => {
    expect(getEligibleExhibits({ items: [
      { id: ' p1 ', type: 'painting' },
      { id: 'x', type: 'light' },
      { id: '', type: 'text' },
    ] })).toEqual([{ id: 'p1', type: 'painting' }]);
  });

  it('evaluates only distinct eligible exhibits and sanitizes dwell values', () => {
    const tasks = buildPassportTasks({ eligibleExhibitCount: 3 }).tasks;
    expect(evaluatePassportProgress(tasks, {
      visitedExhibitIds: ['a', 'a', 'b', 'c', 'unknown'],
      engagedExhibitIds: ['b', 'b', 'unknown'],
      dwellSecondsByExhibit: { a: -1, b: Number.NaN, c: 24, unknown: 100 },
    }, ['a', 'b', 'c'])).toEqual({
      completedTaskIds: ['visit-count', 'dwell-one', 'engage-count'],
      visitedCount: 3,
      engagedCount: 1,
      longestDwellSeconds: 24,
      complete: true,
    });
  });

  it('accepts the exact dwell boundary and reports incomplete progress', () => {
    const tasks = buildPassportTasks({ eligibleExhibitCount: 3 }).tasks;
    expect(evaluatePassportProgress(tasks, {
      visitedExhibitIds: ['a'], engagedExhibitIds: [], dwellSecondsByExhibit: { a: 20 },
    }, ['a', 'b', 'c'])).toMatchObject({
      completedTaskIds: ['dwell-one'], complete: false, longestDwellSeconds: 20,
    });
  });
});
