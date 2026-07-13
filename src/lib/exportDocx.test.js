import { describe, expect, it } from 'vitest';
import { getExercisesPerPage, normalizeColumnCount } from './exportDocx';

describe('portrait Word layout', () => {
  it('supports one to five columns and clamps invalid values', () => {
    expect(normalizeColumnCount(1)).toBe(1);
    expect(normalizeColumnCount(5)).toBe(5);
    expect(normalizeColumnCount(0)).toBe(1);
    expect(normalizeColumnCount(9)).toBe(5);
  });

  it('calculates page capacity from density and column count', () => {
    expect(getExercisesPerPage('compact', 1)).toBe(30);
    expect(getExercisesPerPage('compact', 3)).toBe(75);
    expect(getExercisesPerPage('compact', 5)).toBe(90);
  });
});
