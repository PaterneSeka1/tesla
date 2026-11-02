import {
  ACTION_DOMAINS,
  ENTREPRISE_MODULE_KEY,
  PRACTICAL_SHEET_KEYS,
  PRACTICAL_SHEETS,
  practicalSheetsFor,
} from '@tesla/shared';
import { pdfText } from '../../common/pdf-text.test-helper.js';
import { renderPracticalSheetPdf } from './practical-sheet-pdf.js';

describe('Fiches pratiques de l’Entreprise', () => {
  it('propose les neuf modèles demandés, aux clés uniques et stables', () => {
    expect(PRACTICAL_SHEET_KEYS).toEqual([
      'grille-selection',
      'proces-verbal',
      'fiche-resume',
      'chronogramme',
      'budget',
      'financement',
      'suivi-execution',
      'bilan',
      'checklist-lancement',
    ]);
    expect(new Set(PRACTICAL_SHEET_KEYS).size).toBe(PRACTICAL_SHEETS.length);
    for (const sheet of PRACTICAL_SHEETS) {
      expect(sheet.source.length, sheet.key).toBeGreaterThan(0);
      expect(sheet.blocks.length, sheet.key).toBeGreaterThan(0);
      for (const block of sheet.blocks) {
        if (block.kind === 'table' && block.widths) {
          expect(block.widths, sheet.key).toHaveLength(block.columns.length);
        }
      }
    }
  });

  it('reprend la grille du Guide : six critères sur cinq points, total sur trente', () => {
    const grid = PRACTICAL_SHEETS.find((sheet) => sheet.key === 'grille-selection')!;
    const table = grid.blocks.find((block) => block.kind === 'table')!;
    expect(table.kind === 'table' && table.rows).toHaveLength(6);
    expect(table.kind === 'table' && table.rows!.every((row) => row[1] === '/5')).toBe(true);
    expect(table.kind === 'table' && table.total).toBe('TOTAL (sur 30)');
  });

  it('présente le tiers d’apport personnel comme un repère historique, jamais comme une obligation', () => {
    const text = JSON.stringify(PRACTICAL_SHEETS.find((sheet) => sheet.key === 'financement'));
    expect(text).toContain('Repère historique');
    expect(text).toContain('à vérifier auprès de l’encadrement');
  });

  it('ne rattache les fiches qu’au module de l’Entreprise', () => {
    expect(practicalSheetsFor(ENTREPRISE_MODULE_KEY)).toHaveLength(9);
    expect(practicalSheetsFor('NT-ROUTE-M10')).toEqual([]);
    expect(practicalSheetsFor(null)).toEqual([]);
  });

  it('compte exactement dix domaines d’action, sans doublon', () => {
    expect(ACTION_DOMAINS).toHaveLength(10);
    expect(new Set(ACTION_DOMAINS).size).toBe(10);
  });

  it('produit un PDF A4 lisible pour chaque fiche, sans donnée de projet', async () => {
    for (const sheet of PRACTICAL_SHEETS) {
      const buffer = await renderPracticalSheetPdf(sheet);
      expect(buffer.subarray(0, 5).toString(), sheet.key).toBe('%PDF-');
      const text = pdfText(buffer);
      expect(text, sheet.key).toContain('Communaut');
      expect(text, sheet.key).toContain('Source :');
    }
    const budget = pdfText(
      await renderPracticalSheetPdf(PRACTICAL_SHEETS.find((sheet) => sheet.key === 'budget')!),
    );
    expect(budget).toContain('Prix unit.');
    expect(budget).toContain('TOTAL');
  });
});
