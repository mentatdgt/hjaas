import { describe, expect, it } from 'vitest';
import { RESET_GAP_MS, RESET_WAIT_MS, resetTap } from './reset';

describe('a tap on Reset mushrooms', () => {
  it('asks first', () => {
    expect(resetTap(undefined, 0)).toBe('arm');
    expect(resetTap(undefined, 90_000)).toBe('arm');
  });

  it('is ignored when it comes too soon after the first: an accidental double tap', () => {
    expect(RESET_GAP_MS).toBe(500);
    for (const later of [0, 1, 150, 300, 499, 499.9]) expect(resetTap(12_000, 12_000 + later)).toBe('ignore');
  });

  it('resets from 500 ms after the first, for as long as it waits', () => {
    expect(RESET_WAIT_MS).toBe(4000);
    for (const later of [500, 501, 1000, RESET_WAIT_MS]) expect(resetTap(12_000, 12_000 + later)).toBe('reset');
  });

  it('counts from the first tap, however many were ignored since', () => {
    const first = 12_000;
    const taps = [150, 300, 450, 600].map((later) => resetTap(first, first + later));
    expect(taps).toEqual(['ignore', 'ignore', 'ignore', 'reset']);
  });
});
