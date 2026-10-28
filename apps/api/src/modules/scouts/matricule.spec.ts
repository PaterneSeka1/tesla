import { matriculeSchema, normalizeMatricule } from '@tesla/shared';

describe('Matricule scout', () => {
  it('conserve les zéros initiaux et normalise casse et espaces', () => {
    expect(normalizeMatricule(' 000 0012 a ')).toBe('0000012A');
    expect(matriculeSchema.parse('0001234b')).toBe('0001234B');
  });

  it('traite une saisie vide comme « non renseigné »', () => {
    expect(matriculeSchema.parse('   ')).toBeNull();
  });

  it('impose 7 chiffres suivis d’une lettre', () => {
    expect(matriculeSchema.safeParse('0000012').success).toBe(false); // lettre manquante
    expect(matriculeSchema.safeParse('000001AB').success).toBe(false); // 6 chiffres
    expect(matriculeSchema.safeParse('00000012A').success).toBe(false); // 8 chiffres
    expect(matriculeSchema.safeParse('0000012-').success).toBe(false);
  });
});
