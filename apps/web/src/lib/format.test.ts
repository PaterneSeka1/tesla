import { describe, expect, it } from 'vitest';
import { formatDate, fullName } from './format';

describe('format', () => {
  it('affiche une date calendaire en français sans décalage de fuseau', () => {
    expect(formatDate('2026-10-01')).toBe('1 octobre 2026');
  });

  it('met le nom de famille en capitales', () => {
    expect(fullName({ firstName: 'Jean', lastName: 'Fictif' })).toBe('FICTIF Jean');
  });
});
