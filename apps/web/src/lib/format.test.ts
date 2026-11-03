import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDate,
  formatMonth,
  formatPoints,
  formatScore,
  formatWaiting,
  fullName,
} from './format';

describe('format', () => {
  it('affiche une taille de stockage lisible', () => {
    expect(formatBytes(300_000)).toBe('1 Mo');
    expect(formatBytes(5.2 * 1024 * 1024)).toBe('6 Mo');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1,5 Go');
    expect(formatBytes(10 * 1024 ** 3)).toBe('10 Go');
    expect(formatBytes(2 * 1024 ** 3)).toBe('2 Go');
  });

  it('affiche un mois en français, sans décalage de fuseau', () => {
    expect(formatMonth('2026-10')).toBe('oct. 2026');
    expect(formatMonth('2027-01-15', 'long')).toBe('janvier 2027');
  });

  it('exprime l’ancienneté d’une attente en jours calendaires', () => {
    const now = new Date('2026-10-29T08:00:00Z');
    expect(formatWaiting('2026-10-29T07:00:00.000Z', now)).toBe('aujourd’hui');
    expect(formatWaiting('2026-10-28T23:00:00.000Z', now)).toBe('depuis hier');
    expect(formatWaiting('2026-10-24T12:00:00.000Z', now)).toBe('depuis 5 jours');
  });

  it('affiche une date calendaire en français sans décalage de fuseau', () => {
    expect(formatDate('2026-10-01')).toBe('1 octobre 2026');
  });

  it('met le nom de famille en capitales', () => {
    expect(fullName({ firstName: 'Jean', lastName: 'Fictif' })).toBe('FICTIF Jean');
  });

  it('affiche barèmes et scores au format français', () => {
    expect(formatPoints(1)).toBe('1 pt');
    expect(formatPoints(2.5)).toBe('2,5 pts');
    expect(formatScore(6.5, 8)).toBe('6,5 / 8');
    expect(formatScore(null, 8)).toBe('—');
  });
});
