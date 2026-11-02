import { randomBytes } from 'node:crypto';
import { medicalRecordDataSchema, saveMedicalRecordInputSchema } from '@tesla/shared';
import { validateEnv } from '../../config/env.js';
import { pdfText } from '../../common/pdf-text.test-helper.js';
import { openMedicalData, sealMedicalData } from './medical-crypto.js';
import { renderMedicalPdf } from './medical-pdf.js';

const key = randomBytes(32);
const OWNER = '0190f0c4-0000-7000-8000-0000000000aa';
const OTHER = '0190f0c4-0000-7000-8000-0000000000bb';
const data = medicalRecordDataSchema.parse({
  phone: '+225 07 00 00 00 00',
  emergencyContacts: [{ name: 'Contact Fictif', relation: 'Parent', phone: '07 11 22 33 44' }],
  allergies: 'Arachide (fictif)',
});

describe('chiffrement des fiches médicales', () => {
  it('rechiffre et relit à l’identique, avec un IV différent à chaque fois', () => {
    const a = sealMedicalData(key, OWNER, data);
    const b = sealMedicalData(key, OWNER, data);
    expect(openMedicalData(key, OWNER, a)).toEqual(data);
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(a.iv).toHaveLength(12);
    expect(a.authTag).toHaveLength(16);
  });

  it('ne contient aucun texte en clair', () => {
    const sealed = sealMedicalData(key, OWNER, data);
    expect(Buffer.from(sealed.ciphertext).toString('latin1')).not.toContain('Arachide');
  });

  it('refuse une fiche recopiée sur un autre compte, une autre clé ou un contenu altéré', () => {
    const sealed = sealMedicalData(key, OWNER, data);
    expect(() => openMedicalData(key, OTHER, sealed)).toThrow();
    expect(() => openMedicalData(randomBytes(32), OWNER, sealed)).toThrow();
    const tampered = new Uint8Array(sealed.ciphertext);
    tampered[0] = tampered[0]! ^ 1;
    expect(() => openMedicalData(key, OWNER, { ...sealed, ciphertext: tampered })).toThrow();
  });
});

describe('formulaire de la fiche médicale', () => {
  it('rend toutes les informations de santé facultatives', () => {
    expect(medicalRecordDataSchema.parse({})).toEqual({
      phone: '',
      emergencyContacts: [],
      allergies: '',
      treatments: '',
      emergencyInstructions: '',
      precautions: '',
      healthContact: '',
    });
  });

  it('refuse un champ inconnu, un téléphone invalide, plus de deux contacts', () => {
    expect(medicalRecordDataSchema.safeParse({ groupeSanguin: 'O+' }).success).toBe(false);
    expect(medicalRecordDataSchema.safeParse({ phone: 'abc' }).success).toBe(false);
    const contact = { name: 'A', relation: 'B', phone: '0700000000' };
    expect(
      medicalRecordDataSchema.safeParse({ emergencyContacts: [contact, contact, contact] }).success,
    ).toBe(false);
    expect(saveMedicalRecordInputSchema.safeParse({ expectedRevision: 0, data: {} }).success).toBe(
      false,
    );
  });
});

describe('configuration', () => {
  const base = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

  it('exige la clé en production, de 32 octets', () => {
    expect(() => validateEnv(base)).toThrow(/MEDICAL_DATA_KEY/);
    expect(() => validateEnv({ ...base, MEDICAL_DATA_KEY: 'court' })).toThrow(/MEDICAL_DATA_KEY/);
    expect(
      validateEnv({ ...base, MEDICAL_DATA_KEY: key.toString('base64') }).MEDICAL_DATA_KEY,
    ).toBeDefined();
  });

  it('reste facultative hors production', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'development' }).MEDICAL_DATA_KEY).toBeUndefined();
  });
});

describe('PDF de la fiche médicale', () => {
  it('produit un A4 aux couleurs de la communauté avec les informations déclarées', async () => {
    const buffer = await renderMedicalPdf({
      holder: {
        firstName: 'Prénom',
        lastName: 'Fictif',
        birthDate: '2007-03-15',
        matricule: 'CI-0000',
        team: 'Équipe fictive',
      },
      data,
      updatedAt: new Date('2026-10-30T10:00:00Z'),
    });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.toString('latin1')).toMatch(/\/MediaBox \[0 0 595\.28 841\.89\]/);
    const text = pdfText(buffer);
    for (const expected of [
      'Communauté Nikola Tesla',
      'Branche Route',
      'Fiche médicale',
      'FICTIF Prénom',
      '15 mars 2007',
      'CI-0000',
      'Contact Fictif (Parent)',
      'Arachide (fictif)',
      'Non renseigné',
      '30 octobre 2026',
      'Page 1 / 1',
    ]) {
      expect(text, expected).toContain(expected);
    }
  });
});
