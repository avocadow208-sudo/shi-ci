import { describe, expect, it } from 'vitest';
import { getBalancedPagePlan, normalizeColumnCount, QUESTION_LINE_SPACING, TARGET_ROWS_BY_COLUMNS } from './exportDocx';

describe('portrait Word layout', () => {
  it('supports one to five columns', () => {
    expect(normalizeColumnCount(1)).toBe(1);
    expect(normalizeColumnCount(5)).toBe(5);
    expect(normalizeColumnCount(0)).toBe(1);
    expect(normalizeColumnCount(8)).toBe(5);
  });

  it('uses relaxed line spacing inside multi-line questions', () => {
    expect(QUESTION_LINE_SPACING).toBe(150);
  });

  it('balances a large vocabulary across full pages', () => {
    const plan = getBalancedPagePlan(2259, 5);
    const rowCounts = plan.map((page) => page.rows);

    expect(plan).toHaveLength(21);
    expect(plan.reduce((total, page) => total + page.count, 0)).toBe(2259);
    expect(Math.max(...rowCounts) - Math.min(...rowCounts)).toBeLessThanOrEqual(1);
    expect(new Set(rowCounts)).toEqual(new Set([21, 22]));
  });

  it('balances every supported column count without losing questions', () => {
    for (let columns = 1; columns <= 5; columns += 1) {
      const plan = getBalancedPagePlan(2259, columns);
      const rowCounts = plan.map((page) => page.rows);
      expect(plan.reduce((total, page) => total + page.count, 0)).toBe(2259);
      expect(Math.max(...rowCounts) - Math.min(...rowCounts)).toBeLessThanOrEqual(1);
      expect(Math.max(...rowCounts)).toBeLessThanOrEqual(TARGET_ROWS_BY_COLUMNS[columns]);
    }
  });

  it('keeps numbering offsets continuous between pages', () => {
    const plan = getBalancedPagePlan(223, 3);
    expect(plan[0].start).toBe(0);
    expect(plan[1].start).toBe(plan[0].count);
    expect(plan.at(-1).start + plan.at(-1).count).toBe(223);
  });
});
