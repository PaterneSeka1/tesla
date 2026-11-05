import { crc32, deflateRawSync } from 'node:zlib';

// Fabrique de classeurs .xlsx synthétiques pour les tests (aucune donnée réelle) : ZIP écrit à la
// main, XML minimal conforme à SpreadsheetML.

export type FixtureCell = string | number | boolean | null | { f: string; v?: number | string };

export interface FixtureSheet {
  name: string;
  rows: FixtureCell[][];
  /** Ligne Excel de la première ligne de `rows` (défaut 1). */
  startLine?: number;
  merges?: string[];
  comments?: { ref: string; text: string }[];
  hidden?: boolean;
}

export interface FixtureOptions {
  date1904?: boolean;
  /** Textes en table partagée (comme Excel) plutôt qu'en ligne. */
  sharedStrings?: boolean;
  extraEntries?: Record<string, Buffer | string>;
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const letter = (index: number) => {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  }
  return result;
};

/** Archive ZIP (méthode deflate) à partir d'un dictionnaire chemin → contenu. */
export function zip(entries: Record<string, Buffer | string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compressed = deflateRawSync(data);
    const nameBuffer = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, compressed);
    centrals.push(central, nameBuffer);
    offset += 30 + nameBuffer.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

/** Classeur .xlsx complet. */
export function buildXlsx(sheets: FixtureSheet[], options: FixtureOptions = {}): Buffer {
  const shared: string[] = [];
  const entries: Record<string, Buffer | string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  };
  const workbookRels: string[] = [];
  const sheetTags: string[] = [];
  sheets.forEach((sheet, index) => {
    const n = index + 1;
    const start = sheet.startLine ?? 1;
    const rows = sheet.rows
      .map((cells, r) => {
        const line = start + r;
        const xml = cells
          .map((cell, c) => {
            const ref = `${letter(c)}${line}`;
            if (cell === null) return '';
            if (typeof cell === 'object') {
              const v = cell.v === undefined ? '' : `<v>${escape(String(cell.v))}</v>`;
              const t = typeof cell.v === 'string' ? ' t="str"' : '';
              return `<c r="${ref}"${t}><f>${escape(cell.f)}</f>${v}</c>`;
            }
            if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
            if (typeof cell === 'boolean') return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
            if (cell.startsWith('#')) return `<c r="${ref}" t="e"><v>${escape(cell)}</v></c>`;
            if (options.sharedStrings) {
              shared.push(cell);
              return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escape(cell)}</t></is></c>`;
          })
          .join('');
        return `<row r="${line}">${xml}</row>`;
      })
      .join('');
    const merges = sheet.merges?.length
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';
    entries[`xl/worksheets/sheet${n}.xml`] =
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData>${merges}</worksheet>`;
    if (sheet.comments?.length) {
      entries[`xl/comments${n}.xml`] =
        `<?xml version="1.0"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>Test</author></authors><commentList>${sheet.comments
          .map(
            (c) =>
              `<comment ref="${c.ref}" authorId="0"><text><t>${escape(c.text)}</t></text></comment>`,
          )
          .join('')}</commentList></comments>`;
      entries[`xl/worksheets/_rels/sheet${n}.xml.rels`] =
        `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments${n}.xml"/></Relationships>`;
    }
    workbookRels.push(
      `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`,
    );
    sheetTags.push(
      `<sheet name="${escape(sheet.name)}" sheetId="${n}"${sheet.hidden ? ' state="hidden"' : ''} r:id="rId${n}"/>`,
    );
  });
  entries['xl/workbook.xml'] =
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr${options.date1904 ? ' date1904="1"' : ''}/><sheets>${sheetTags.join('')}</sheets></workbook>`;
  entries['xl/_rels/workbook.xml.rels'] =
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels.join('')}</Relationships>`;
  if (shared.length > 0) {
    entries['xl/sharedStrings.xml'] =
      `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared
        .map((s) => `<si><t xml:space="preserve">${escape(s)}</t></si>`)
        .join('')}</sst>`;
  }
  return zip({ ...entries, ...options.extraEntries });
}

/** Numéro de série Excel (calendrier 1900) d'une date AAAA-MM-JJ. */
export const excelSerial = (iso: string) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000);

/** En-têtes du modèle de programme annuel (structure du classeur de la communauté). */
export const PROGRAMME_HEADER = [
  'N°',
  'Date du samedi',
  'Mois',
  'Axe du mois',
  'Temps commun / objectif',
  'Novices Routiers',
  'Aspirants Routiers',
  'Compagnons Routiers',
  'Routiers Confirmés',
  'Format',
  'Responsable',
  'Statut',
  'Présents (facultatif)',
  'Observations / validations',
];

const MONTHS = [
  'JANVIER',
  'FÉVRIER',
  'MARS',
  'AVRIL',
  'MAI',
  'JUIN',
  'JUILLET',
  'AOÛT',
  'SEPTEMBRE',
  'OCTOBRE',
  'NOVEMBRE',
  'DÉCEMBRE',
];

/** Ligne de séance fictive au format du modèle. */
export function programmeRow(
  number: number,
  iso: string,
  title: string,
  extra: { status?: string; notes?: string; format?: string; theme?: string } = {},
): (string | number | null)[] {
  const month = `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  return [
    number,
    excelSerial(iso),
    month,
    extra.theme ?? 'Axe fictif',
    title,
    `Contenu novices ${number}`,
    `Contenu aspirants ${number}`,
    `Contenu compagnons ${number}`,
    `Contenu confirmés ${number}`,
    extra.format ?? 'Atelier',
    null,
    extra.status ?? 'Planifiée',
    null,
    extra.notes ?? null,
  ];
}

/** Classeur au format du modèle : bandeau titre fusionné, en-têtes en ligne 3, note finale. */
export function programmeWorkbook(rows: FixtureCell[][], options: FixtureOptions = {}): Buffer {
  return buildXlsx(
    [
      {
        name: 'Programme annuel',
        rows: [
          ['PROGRAMME ANNUEL FICTIF'],
          [],
          PROGRAMME_HEADER,
          ...rows,
          [],
          ['NOTE  |  Texte fictif.'],
        ],
        merges: ['A1:K1', `A${rows.length + 5}:N${rows.length + 5}`],
      },
    ],
    options,
  );
}
