import { buildXlsx, excelSerial, zip } from '../../../test/xlsx-fixture.js';
import { parseXml, readXlsx, XlsxReadError } from './xlsx-reader.js';

const minimal = (extra: Record<string, string>) =>
  buildXlsx([{ name: 'F', rows: [['x']] }], { extraEntries: extra });

describe('Lecteur XLSX', () => {
  it('lit textes en ligne et partagés, nombres, booléens et dates en série', () => {
    for (const sharedStrings of [false, true]) {
      const book = readXlsx(
        buildXlsx(
          [
            {
              name: 'Programme',
              rows: [
                ['Date', 'Titre', 'Vrai'],
                [excelSerial('2026-10-10'), 'Séance « fictive » & co', true],
              ],
            },
          ],
          { sharedStrings },
        ),
      );
      expect(book.date1904).toBe(false);
      expect(book.sheets[0]).toMatchObject({ name: 'Programme', columnCount: 3 });
      expect(book.sheets[0]!.rows[1]).toMatchObject({
        line: 2,
        cells: [46305, 'Séance « fictive » & co', true],
      });
    }
  });

  it('signale le calendrier 1904, les feuilles masquées et conserve l’ordre des feuilles', () => {
    const book = readXlsx(
      buildXlsx(
        [
          { name: 'Visible', rows: [['a']] },
          { name: 'Cachée', rows: [['b']], hidden: true },
        ],
        { date1904: true },
      ),
    );
    expect(book.date1904).toBe(true);
    expect(book.sheets.map((s) => [s.name, s.hidden])).toEqual([
      ['Visible', false],
      ['Cachée', true],
    ]);
  });

  it('reporte une fusion verticale sur chaque ligne, pas une fusion horizontale', () => {
    const sheet = readXlsx(
      buildXlsx([
        {
          name: 'F',
          rows: [
            ['Axe', 'Titre', 'Note'],
            ['Axe commun', 'A', 'Bandeau'],
            [null, 'B', null],
          ],
          merges: ['A2:A3', 'C2:D2'],
        },
      ]),
    ).sheets[0]!;
    expect(sheet.rows[2]!.cells).toEqual(['Axe commun', 'B', null]);
    expect(sheet.rows[1]!.cells).toEqual(['Axe commun', 'A', 'Bandeau']);
    expect(sheet.merges.map((m) => m.ref)).toEqual(['A2:A3', 'C2:D2']);
  });

  it('n’exécute aucune formule : valeur en cache, formules et erreurs signalées', () => {
    const sheet = readXlsx(
      buildXlsx([
        {
          name: 'F',
          rows: [
            [{ f: 'A2+7', v: 46312 }, { f: 'CONCAT("a","b")' }, '#N/A', { f: 'B1', v: 'texte' }],
          ],
        },
      ]),
    ).sheets[0]!;
    expect(sheet.rows[0]!.cells).toEqual([46312, null, null, 'texte']);
    expect(sheet.formulaCells).toEqual([
      { line: 1, col: 0, cached: true },
      { line: 1, col: 1, cached: false },
      { line: 1, col: 3, cached: true },
    ]);
    expect(sheet.errorCells).toEqual([{ line: 1, col: 2, value: '#N/A' }]);
  });

  it('rattache les commentaires de cellule à leur ligne', () => {
    const sheet = readXlsx(
      buildXlsx([
        {
          name: 'F',
          rows: [['Titre'], ['Séance']],
          comments: [
            { ref: 'A2', text: 'Date à confirmer' },
            { ref: 'C9', text: 'Hors tableau' },
          ],
        },
      ]),
    ).sheets[0]!;
    expect(sheet.rows[1]!.notes).toEqual(['Date à confirmer']);
    expect(sheet.comments).toEqual([{ line: 9, col: 2, text: 'Hors tableau' }]);
  });

  it('refuse les fichiers qui ne sont pas des classeurs .xlsx', () => {
    expect(() => readXlsx(Buffer.from('bonjour'))).toThrow(XlsxReadError);
    const ole = Buffer.alloc(64);
    ole.writeUInt32BE(0xd0cf11e0, 0);
    expect(() => readXlsx(ole)).toThrow(/\.xls/);
    expect(() => readXlsx(zip({ 'a.txt': 'x' }))).toThrow(/pas un classeur/);
    expect(() => readXlsx(buildXlsx([{ name: 'F', rows: [['x']] }]).subarray(0, 200))).toThrow(
      XlsxReadError,
    );
  });

  it('refuse macros, DTD et bombes de décompression', () => {
    expect(() => readXlsx(minimal({ 'xl/vbaProject.bin': 'x' }))).toThrow(/macros/);
    expect(() => parseXml('<!DOCTYPE x [<!ENTITY a "aaaa">]><x>&a;</x>')).toThrow(/DTD/);
    // 64 Mo de zéros compressés en quelques dizaines de ko : plafond de décompression.
    const bomb = buildXlsx([{ name: 'F', rows: [['x']] }], {
      extraEntries: { 'xl/sharedStrings.xml': Buffer.alloc(64 * 1024 * 1024, 0x20) },
    });
    expect(bomb.length).toBeLessThan(200_000);
    expect(() => readXlsx(bomb)).toThrow(/trop volumineux/);
  });

  it('limite le nombre de colonnes et de lignes', () => {
    const wide = buildXlsx([{ name: 'F', rows: [Array.from({ length: 101 }, () => 'x')] }]);
    expect(() => readXlsx(wide)).toThrow(/trop large/);
    const long = buildXlsx([{ name: 'F', rows: Array.from({ length: 2001 }, () => ['x']) }]);
    expect(() => readXlsx(long)).toThrow(/trop longue/);
  });

  it('décode entités et caractères Unicode', () => {
    const root = parseXml('<a b="&lt;1&gt;">&#233;t&#xE9; &amp; « ok »<![CDATA[<brut>]]></a>');
    expect(root.children[0]).toMatchObject({ attrs: { b: '<1>' }, text: 'été & « ok »<brut>' });
    expect(() => parseXml('<a><b></a>')).toThrow(XlsxReadError);
  });
});
