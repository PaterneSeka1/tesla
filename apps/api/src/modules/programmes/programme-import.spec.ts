import {
  detectProgrammeField,
  excelSerialToIsoDate,
  normalizeProgrammeTable,
  parseProgrammeDate,
  PROGRAMME_CATEGORIES,
  type ProgrammeTable,
  recognizeSourceStatus,
  resolveProgrammeMapping,
} from '@tesla/shared';
import { excelSerial, PROGRAMME_HEADER, programmeRow } from '../../../test/xlsx-fixture.js';

const categories = PROGRAMME_CATEGORIES.map((c) => ({ code: c.code, label: c.label }));
const keys = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

function table(header: string[], rows: ProgrammeTable['rows']): ProgrammeTable {
  return { header, columnKeys: keys(header.length), rows, excelDates: { date1904: false } };
}

describe('Import du programme : colonnes', () => {
  it('reconnaît les quatorze colonnes du modèle de la communauté', () => {
    const { columns, issues } = resolveProgrammeMapping(table(PROGRAMME_HEADER, []), categories);
    expect(issues).toEqual([]);
    expect(columns.map((c) => c.field)).toEqual([
      'sourceNumber',
      'date',
      'month',
      'theme',
      'title',
      'category:NOVICES',
      'category:ASPIRANTS',
      'category:COMPAGNONS',
      'category:CONFIRMES',
      'format',
      'leaderLabel',
      'sourceStatus',
      'sourceAttendance',
      'planningNotes',
    ]);
  });

  it('tolère accents, casse, espaces et singulier ; jamais de rapprochement approximatif', () => {
    expect(detectProgrammeField('  DATE  du SAMEDI ', categories)).toBe('date');
    expect(detectProgrammeField('Novice routier', categories)).toBe('category:NOVICES');
    expect(detectProgrammeField('Confirmes', categories)).toBe('category:CONFIRMES');
    expect(detectProgrammeField('Dat', categories)).toBeNull();
    expect(detectProgrammeField('Routiers', categories)).toBeNull();
  });

  it('bloque une colonne inconnue non vide, sauf correspondance ou « ignorer » explicite', () => {
    const t = table(['Date', 'Titre', 'Budget'], [{ line: 2, cells: ['2026-10-10', 'A', '1000'] }]);
    const strict = resolveProgrammeMapping(t, categories);
    expect(strict.issues).toEqual([expect.objectContaining({ severity: 'ERREUR', column: 'C' })]);
    expect(resolveProgrammeMapping(t, categories, { C: 'ignore' }).issues).toEqual([]);
    expect(resolveProgrammeMapping(t, categories, { C: 'planningNotes' }).mapping).toEqual([
      'date',
      'title',
      'planningNotes',
    ]);
    expect(resolveProgrammeMapping(t, categories, { C: 'inventé' }).issues[0]?.message).toContain(
      'inconnue',
    );
    expect(resolveProgrammeMapping(t, categories, { C: 'title' }).issues[0]?.message).toContain(
      'même champ',
    );
  });

  it('exige les colonnes Date et Intitulé', () => {
    const { issues } = resolveProgrammeMapping(table(['Axe', 'Format'], []), categories);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/Date.*Intitulé/s);
  });
});

describe('Import du programme : lignes', () => {
  const header = PROGRAMME_HEADER;
  const mapping = resolveProgrammeMapping(table(header, []), categories).mapping;

  it('normalise une séance : date Excel, quatre contenus, statut et commentaires', () => {
    const cells = programmeRow(1, '2026-10-10', 'Reprise fictive', {
      status: 'Tenue',
      notes: 'Note fictive',
    });
    const result = normalizeProgrammeTable(
      table(header, [{ line: 9, cells, notes: [null, 'Commentaire fictif'] }]),
      mapping,
      categories,
    );
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      line: 9,
      date: '2026-10-10',
      title: 'Reprise fictive',
      theme: 'Axe fictif',
      format: 'Atelier',
      leaderLabel: null,
      sourceStatus: 'Tenue',
      sourceAttendance: null,
      sourceNumber: 1,
      planningNotes: 'Note fictive\nCommentaire (Date du samedi) : Commentaire fictif',
      categoryContents: {
        NOVICES: 'Contenu novices 1',
        ASPIRANTS: 'Contenu aspirants 1',
        COMPAGNONS: 'Contenu compagnons 1',
        CONFIRMES: 'Contenu confirmés 1',
      },
    });
    expect(result.categoryCodes.get(9)).toEqual([
      'NOVICES',
      'ASPIRANTS',
      'COMPAGNONS',
      'CONFIRMES',
    ]);
    expect(recognizeSourceStatus('Tenue')).toBe('REALISEE');
  });

  it('signale dates invalides ou manquantes, intitulé vide et doublons ; écarte les notes', () => {
    const row = (line: number, date: string | number | null, title: string | null) => ({
      line,
      cells: [line, date, null, null, title, null, null, null, null, null, null, null, null, null],
    });
    const result = normalizeProgrammeTable(
      table(header, [
        row(9, excelSerial('2026-10-10'), 'A'),
        row(10, '31/02/2027', 'B'),
        row(11, null, 'C'),
        row(12, '2026-10-17', null),
        row(13, '10/10/2026', 'a'),
        { line: 20, cells: ['NOTE | texte libre'] },
        { line: 21, cells: [] },
      ]),
      mapping,
      categories,
    );
    expect(result.rows.map((r) => r.line)).toEqual([9]);
    expect(result.rejected.map((r) => [r.line, r.messages[0]])).toEqual([
      [10, expect.stringContaining('Date invalide « 31/02/2027 »')],
      [11, 'Date manquante.'],
      [12, expect.stringContaining('Intitulé')],
      [13, expect.stringContaining('Doublon de la ligne 9')],
    ]);
    const note = result.issues.find((i) => i.line === 20);
    expect(note?.severity).toBe('AVERTISSEMENT');
    expect(note?.message).toContain('NOTE');
    expect(result.issues.find((i) => i.line === 10)).toMatchObject({ column: 'B' });
  });

  it('avertit sans bloquer : statut inconnu, mois incohérent, effectif non numérique', () => {
    const cells = programmeRow(2, '2026-10-17', 'B', { status: 'Peut-être' });
    cells[2] = 'NOVEMBRE 2026';
    cells[12] = 'une dizaine';
    const result = normalizeProgrammeTable(
      table(header, [{ line: 10, cells }]),
      mapping,
      categories,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.issues.map((i) => i.severity)).toEqual([
      'AVERTISSEMENT',
      'AVERTISSEMENT',
      'AVERTISSEMENT',
    ]);
    expect(result.issues.map((i) => i.column).sort()).toEqual(['C', 'L', 'M']);
  });

  it('lit les dates textuelles et les numéros de série (1900 et 1904)', () => {
    expect(parseProgrammeDate('samedi 10 octobre 2026')).toBe('2026-10-10');
    expect(parseProgrammeDate('1er déc. 2026')).toBe('2026-12-01');
    expect(parseProgrammeDate('10.10.2026')).toBe('2026-10-10');
    expect(parseProgrammeDate('2026-10-10T00:00:00')).toBe('2026-10-10');
    expect(parseProgrammeDate('10 brumaire 2026')).toBeNull();
    expect(excelSerialToIsoDate(46305)).toBe('2026-10-10');
    expect(excelSerialToIsoDate(46305.75)).toBe('2026-10-10');
    expect(excelSerialToIsoDate(44843, true)).toBe('2026-10-10');
    expect(excelSerialToIsoDate(-1)).toBeNull();
  });

  it('accepte des colonnes réordonnées et incomplètes', () => {
    const shuffled = ['Statut', 'Temps commun / objectif', 'Date', 'Novices'];
    const t = table(shuffled, [{ line: 2, cells: ['Prévue', 'Séance X', '14/11/2026', 'Nœuds'] }]);
    const { mapping: m, issues } = resolveProgrammeMapping(t, categories);
    expect(issues).toEqual([]);
    const result = normalizeProgrammeTable(t, m, categories);
    expect(result.rows[0]).toMatchObject({
      date: '2026-11-14',
      title: 'Séance X',
      categoryContents: { NOVICES: 'Nœuds' },
    });
    expect(result.rows[0]!.format).toBeUndefined();
  });
});
