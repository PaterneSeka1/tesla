import { describe, expect, it } from 'vitest';
import { nextUnanswered, PALIER_SIZE, reachedPaliers } from './palier-game';

describe('mode jeu à paliers (D140)', () => {
  it('compte les paliers entièrement répondus, dans l’ordre', () => {
    expect(PALIER_SIZE).toBe(3);
    expect(reachedPaliers([true, true, true, true, false, true, true])).toBe(1);
    expect(reachedPaliers([true, true, true, true, true, true, true])).toBe(3);
    expect(reachedPaliers([false, true, true])).toBe(0);
    expect(reachedPaliers([])).toBe(0);
  });

  it('va à la prochaine question sans réponse, en revenant aux questions passées', () => {
    expect(nextUnanswered([true, false, true, false], 1)).toBe(3);
    expect(nextUnanswered([false, true, true, true], 2)).toBe(0);
    expect(nextUnanswered([true, true], 0)).toBeNull();
  });
});
