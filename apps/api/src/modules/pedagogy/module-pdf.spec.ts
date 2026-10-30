import { inflateSync } from 'node:zlib';
import { type PrintableModule } from '@tesla/shared';
import { renderModulePdf } from './module-pdf.js';

/** Texte affiché d'un PDF pdfkit : flux décompressés, chaînes hexadécimales des opérateurs TJ. */
function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  let text = '';
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1]!, 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const array of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const hex of array[1]!.matchAll(/<([0-9a-fA-F]*)>/g)) {
        text += Buffer.from(hex[1]!, 'hex').toString('latin1');
      }
      text += '\n';
    }
  }
  return text;
}

const paragraph = (text: string) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text }],
});

const module: PrintableModule = {
  slug: 'route-m08-le-raid-routier',
  code: 'MOD-031',
  version: 2,
  title: 'Le Raid routier',
  summary: 'Une activité itinérante exigeante.',
  stage: {
    id: '0190f0c4-0000-7000-8000-000000000001',
    code: 'COMPAGNONNAGE',
    name: 'Compagnonnage',
    position: 3,
  },
  theme: 'Formation à la Route',
  category: 'ETAPE',
  obligation: null,
  official: false,
  durationMinutes: null,
  lessonCount: 2,
  publishedAt: '2026-10-30T10:00:00.000Z',
  objectives: ['Préparer un itinéraire réaliste.'],
  prerequisites: null,
  lessons: [
    {
      id: '0190f0c4-0000-7000-8000-000000000002',
      position: 0,
      title: 'Qu’est-ce qu’un Raid ?',
      durationMinutes: null,
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Définition' }] },
          paragraph('Une activité itinérante.'),
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [paragraph('Endurance physique et mentale')] }],
          },
          { type: 'blockquote', content: [paragraph('Citation du manuel')] },
          { type: 'image', attrs: { src: 'https://example.test/carte.png', alt: 'Carte' } },
        ],
      },
      resources: [],
    },
    {
      id: '0190f0c4-0000-7000-8000-000000000003',
      position: 1,
      title: 'Relecture du Raid',
      durationMinutes: null,
      content: { type: 'doc', content: [paragraph('Temps de relecture.')] },
      resources: [],
    },
  ],
  resources: [],
};

describe('Support de cours PDF', () => {
  it('produit un PDF A4 avec page de garde, une page par leçon, logo et nom sur chaque page', async () => {
    const buffer = await renderModulePdf(module);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const raw = buffer.toString('latin1');
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(3);
    // Logo de la communauté intégré (image) si présent dans l'application web.
    expect(raw).toContain('/Subtype /Image');
    const text = pdfText(buffer);
    // Garde (1) + en-têtes des deux pages de leçon (2) + pieds de page (3).
    expect(text.match(/Communauté Nikola Tesla/g)).toHaveLength(6);
    expect(text).toContain('Support de cours');
    expect(text).toContain('Le Raid routier');
    expect(text).toContain('Étape recommandée : Compagnonnage');
    expect(text).toContain('MOD-031 · version 2 · page 3 / 3');
    expect(text).toContain('LEÇON 2 / 2');
    expect(text).toContain('Endurance physique et mentale');
    expect(text).toContain('Citation du manuel');
    expect(text).toContain('https://example.test/carte.png');
  });
});
