import { matriculeSchema, normalizeMatricule } from '@tesla/shared';

describe('Matricule scout', () => {
  it('conserve les zéros initiaux et normalise casse et espaces', () => {
    expect(normalizeMatricule(' 00 12-ab ')).toBe('0012-AB');
    expect(matriculeSchema.parse('000123')).toBe('000123');
  });

  it('traite une saisie vide comme « non renseigné »', () => {
    expect(matriculeSchema.parse('   ')).toBeNull();
  });

  it('rejette les caractères non admis et les valeurs trop longues', () => {
    expect(matriculeSchema.safeParse('12#4').success).toBe(false);
    expect(matriculeSchema.safeParse('A'.repeat(33)).success).toBe(false);
  });
});
