import { describe, expect, it } from 'vitest';
import { EXPORT_COLUMNS, getBalancedPagePlan, QUESTION_LINE_SPACING } from './exportDocx';

describe('portrait Word layout', () => {
  it('always uses five columns', () => {
    expect(EXPORT_COLUMNS).toBe(5);
  });

  it('uses relaxed line spacing inside multi-line questions', () => {
    expect(QUESTION_LINE_SPACING).toBe(150);
  });

  it('balances a large vocabulary across full pages', () => {
    const plan = getBalancedPagePlan(2259);
    const rowCounts = plan.map((page) => page.rows);

    expect(plan).toHaveLength(21);
    expect(plan.reduce((total, page) => total + page.count, 0)).toBe(2259);
    expect(Math.max(...rowCounts) - Math.min(...rowCounts)).toBeLessThanOrEqual(1);
    expect(new Set(rowCounts)).toEqual(new Set([21, 22]));
  });

  it('keeps numbering offsets continuous between pages', () => {
    const plan = getBalancedPagePlan(223);
    expect(plan[0].start).toBe(0);
    expect(plan[1].start).toBe(plan[0].count);
    expect(plan.at(-1).start + plan.at(-1).count).toBe(223);
  });
});
