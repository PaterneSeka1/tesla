import { inflateRawSync } from 'node:zlib';

// Lecteur XLSX minimal et défensif pour l'import du programme annuel (D172). Aucune dépendance :
// lecture du répertoire ZIP, décompression bornée (`maxOutputLength`), XML sans DTD ni entité
// externe. Aucune macro, aucune formule n'est exécutée : seule la dernière valeur calculée par
// Excel (cache) est lue. Le fichier n'est jamais écrit sur disque.

export const XLSX_LIMITS = {
  maxEntries: 500,
  /** Taille décompressée maximale d'une partie lue (XML). */
  maxPartBytes: 8 * 1024 * 1024,
  /** Budget total décompressé pour un classeur. */
  maxTotalBytes: 24 * 1024 * 1024,
  maxSheets: 20,
  maxRows: 2000,
  maxColumns: 100,
  maxXmlNodes: 600_000,
  maxCellChars: 20_000,
} as const;

/** Erreur de lecture affichable telle quelle (aucun détail interne). */
export class XlsxReadError extends Error {}

export type XlsxCell = string | number | boolean | null;

export interface XlsxRow {
  /** Numéro de ligne Excel (1 = première ligne). */
  line: number;
  cells: XlsxCell[];
  notes: (string | null)[];
}

export interface XlsxMerge {
  ref: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface XlsxSheet {
  name: string;
  hidden: boolean;
  rows: XlsxRow[];
  columnCount: number;
  merges: XlsxMerge[];
  /** Cellules à formule (valeur en cache utilisée), par « ligne:colonne ». */
  formulaCells: { line: number; col: number; cached: boolean }[];
  /** Cellules en erreur (#N/A, #REF!…), remplacées par une cellule vide. */
  errorCells: { line: number; col: number; value: string }[];
  /** Commentaires de cellules situés hors des lignes lues (signalés par l'appelant). */
  comments: { line: number; col: number; text: string }[];
}

export interface XlsxWorkbook {
  date1904: boolean;
  sheets: XlsxSheet[];
}

// ─── ZIP ────────────────────────────────────────────────────────────────────

interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  localOffset: number;
}

function readCentralDirectory(buffer: Buffer): Map<string, ZipEntry> {
  if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0xd0cf11e0) {
    throw new XlsxReadError(
      'Ancien format Excel (.xls) ou classeur protégé par mot de passe : enregistrez-le au format .xlsx sans mot de passe.',
    );
  }
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new XlsxReadError('Ce fichier n’est pas un classeur Excel .xlsx valide.');
  }
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxReadError('Classeur incomplet ou endommagé.');
  const count = buffer.readUInt16LE(eocd + 10);
  const offset = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) {
    throw new XlsxReadError('Classeur trop volumineux pour être importé.');
  }
  if (count > XLSX_LIMITS.maxEntries) throw new XlsxReadError('Classeur trop complexe.');
  const entries = new Map<string, ZipEntry>();
  let position = offset;
  for (let i = 0; i < count; i += 1) {
    if (position + 46 > buffer.length || buffer.readUInt32LE(position) !== 0x02014b50) {
      throw new XlsxReadError('Classeur endommagé (répertoire illisible).');
    }
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const name = buffer.toString('utf8', position + 46, position + 46 + nameLength);
    entries.set(name, {
      name,
      flags: buffer.readUInt16LE(position + 8),
      method: buffer.readUInt16LE(position + 10),
      compressedSize: buffer.readUInt32LE(position + 20),
      localOffset: buffer.readUInt32LE(position + 42),
    });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

class ZipReader {
  private readonly entries: Map<string, ZipEntry>;
  private inflated = 0;

  constructor(private readonly buffer: Buffer) {
    this.entries = readCentralDirectory(buffer);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  read(name: string): string | null {
    const entry = this.entries.get(name);
    if (!entry) return null;
    if (entry.flags & 0x1) throw new XlsxReadError('Classeur chiffré : retirez le mot de passe.');
    const header = entry.localOffset;
    if (header + 30 > this.buffer.length || this.buffer.readUInt32LE(header) !== 0x04034b50) {
      throw new XlsxReadError('Classeur endommagé.');
    }
    const start =
      header + 30 + this.buffer.readUInt16LE(header + 26) + this.buffer.readUInt16LE(header + 28);
    const end = start + entry.compressedSize;
    if (end > this.buffer.length) throw new XlsxReadError('Classeur endommagé.');
    const data = this.buffer.subarray(start, end);
    const budget = Math.min(XLSX_LIMITS.maxPartBytes, XLSX_LIMITS.maxTotalBytes - this.inflated);
    let output: Buffer;
    if (entry.method === 0) {
      output = data;
    } else if (entry.method === 8) {
      try {
        output = inflateRawSync(data, { maxOutputLength: Math.max(budget, 1) });
      } catch (error) {
        if (error instanceof RangeError) throw new XlsxReadError('Classeur trop volumineux.');
        throw new XlsxReadError('Classeur endommagé (décompression impossible).');
      }
    } else {
      throw new XlsxReadError('Compression du classeur non prise en charge.');
    }
    if (output.length > budget) throw new XlsxReadError('Classeur trop volumineux.');
    this.inflated += output.length;
    return output.toString('utf8');
  }
}

// ─── XML ────────────────────────────────────────────────────────────────────

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, entity: string) => {
    if (entity.startsWith('#x')) return safeCodePoint(Number.parseInt(entity.slice(2), 16), whole);
    if (entity.startsWith('#')) return safeCodePoint(Number.parseInt(entity.slice(1), 10), whole);
    return ENTITIES[entity] ?? whole;
  });
}

function safeCodePoint(code: number, fallback: string): string {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : fallback;
}

const localName = (name: string) => name.slice(name.indexOf(':') + 1);

/** Analyse XML stricte et bornée : DTD refusée, entités externes jamais résolues. */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  const token =
    /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!([^>]*)>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/y;
  const attribute = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let nodes = 0;
  while (token.lastIndex < xml.length) {
    const start = token.lastIndex;
    const match = token.exec(xml);
    if (!match || match.index !== start) throw new XlsxReadError('Classeur endommagé (XML).');
    const current = stack[stack.length - 1]!;
    if (match[1] !== undefined) current.text += match[1];
    else if (match[2] !== undefined) throw new XlsxReadError('Classeur refusé (DTD interdite).');
    else if (match[3] !== undefined) {
      if (stack.length === 1 || current.name !== localName(match[3])) {
        throw new XlsxReadError('Classeur endommagé (XML).');
      }
      stack.pop();
    } else if (match[4] !== undefined) {
      nodes += 1;
      if (nodes > XLSX_LIMITS.maxXmlNodes) throw new XlsxReadError('Classeur trop complexe.');
      const node: XmlNode = { name: localName(match[4]), attrs: {}, children: [], text: '' };
      for (const attr of (match[5] ?? '').matchAll(attribute)) {
        const value = decodeEntities(attr[2] ?? attr[3] ?? '');
        node.attrs[attr[1]!] = value;
        node.attrs[localName(attr[1]!)] ??= value;
      }
      current.children.push(node);
      if (match[6] !== '/') stack.push(node);
    } else if (match[7] !== undefined) {
      current.text += decodeEntities(match[7]);
    }
  }
  if (stack.length !== 1) throw new XlsxReadError('Classeur endommagé (XML incomplet).');
  return root;
}

const child = (node: XmlNode | undefined, name: string) =>
  node?.children.find((c) => c.name === name);
const childrenNamed = (node: XmlNode | undefined, name: string) =>
  node?.children.filter((c) => c.name === name) ?? [];

/** Texte d'un élément riche (`<t>` direct ou `<r><t>`), sans les annotations phonétiques. */
function richText(node: XmlNode | undefined): string {
  if (!node) return '';
  let text = '';
  for (const c of node.children) {
    if (c.name === 't') text += c.text;
    else if (c.name === 'r')
      text += childrenNamed(c, 't')
        .map((t) => t.text)
        .join('');
  }
  // Échappements OOXML (_x000D_ pour le retour chariot).
  return text.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

// ─── Classeur ───────────────────────────────────────────────────────────────

/** « B9 » → { col: 1, line: 9 } */
export function parseCellRef(ref: string): { col: number; line: number } | null {
  const match = /^([A-Z]{1,3})([0-9]{1,7})$/.exec(ref);
  if (!match) return null;
  let col = 0;
  for (const char of match[1]!) col = col * 26 + (char.charCodeAt(0) - 64);
  return { col: col - 1, line: Number(match[2]) };
}

function resolveTarget(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function relationships(zip: ZipReader, partPath: string): Map<string, XmlNode> {
  const slash = partPath.lastIndexOf('/');
  const relsPath = `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`;
  const xml = zip.read(relsPath);
  const map = new Map<string, XmlNode>();
  if (!xml) return map;
  for (const rel of childrenNamed(child(parseXml(xml), 'Relationships'), 'Relationship')) {
    if (rel.attrs.Id) map.set(rel.attrs.Id, rel);
  }
  return map;
}

function textLimit(value: string): string {
  if (value.length > XLSX_LIMITS.maxCellChars) {
    throw new XlsxReadError(
      'Une cellule contient un texte trop long (20 000 caractères au maximum).',
    );
  }
  return value;
}

function readSheet(
  zip: ZipReader,
  path: string,
  name: string,
  hidden: boolean,
  sharedStrings: string[],
): XlsxSheet {
  const xml = zip.read(path);
  if (!xml) throw new XlsxReadError(`Feuille « ${name} » introuvable dans le classeur.`);
  const worksheet = child(parseXml(xml), 'worksheet');
  const sheet: XlsxSheet = {
    name,
    hidden,
    rows: [],
    columnCount: 0,
    merges: [],
    formulaCells: [],
    errorCells: [],
    comments: [],
  };
  const byLine = new Map<number, XlsxRow>();
  let nextLine = 1;
  for (const rowNode of childrenNamed(child(worksheet, 'sheetData'), 'row')) {
    const line = rowNode.attrs.r ? Number(rowNode.attrs.r) : nextLine;
    if (!Number.isInteger(line) || line < 1) throw new XlsxReadError('Classeur endommagé.');
    nextLine = line + 1;
    const row: XlsxRow = { line, cells: [], notes: [] };
    let nextCol = 0;
    for (const cell of childrenNamed(rowNode, 'c')) {
      const ref = cell.attrs.r ? parseCellRef(cell.attrs.r) : { col: nextCol, line };
      if (!ref) throw new XlsxReadError('Classeur endommagé (référence de cellule).');
      nextCol = ref.col + 1;
      if (ref.col >= XLSX_LIMITS.maxColumns) {
        throw new XlsxReadError(`Feuille « ${name} » trop large (100 colonnes au maximum).`);
      }
      const type = cell.attrs.t ?? 'n';
      const v = child(cell, 'v');
      const formula = child(cell, 'f');
      let value: XlsxCell = null;
      if (type === 'inlineStr') value = richText(child(cell, 'is'));
      else if (v) {
        if (type === 's') {
          const shared = sharedStrings[Number(v.text)];
          if (shared === undefined) throw new XlsxReadError('Classeur endommagé (texte partagé).');
          value = shared;
        } else if (type === 'b') value = v.text === '1';
        else if (type === 'e') {
          sheet.errorCells.push({ line, col: ref.col, value: v.text });
          value = null;
        } else if (type === 'str' || type === 'd') value = v.text;
        else {
          const number = Number(v.text);
          value = v.text.trim() !== '' && Number.isFinite(number) ? number : v.text;
        }
      }
      if (formula) sheet.formulaCells.push({ line, col: ref.col, cached: v !== undefined });
      if (typeof value === 'string') value = textLimit(value);
      if (value === '') value = null;
      row.cells[ref.col] = value;
      sheet.columnCount = Math.max(sheet.columnCount, ref.col + 1);
    }
    if (row.cells.some((c) => c !== null && c !== undefined)) {
      byLine.set(line, row);
      if (byLine.size > XLSX_LIMITS.maxRows) {
        throw new XlsxReadError(`Feuille « ${name} » trop longue (2 000 lignes au maximum).`);
      }
    }
  }

  for (const merge of childrenNamed(child(worksheet, 'mergeCells'), 'mergeCell')) {
    const [from, to] = (merge.attrs.ref ?? '').split(':');
    const a = from ? parseCellRef(from) : null;
    const b = to ? parseCellRef(to) : a;
    if (!a || !b) continue;
    sheet.merges.push({
      ref: merge.attrs.ref ?? '',
      startRow: a.line,
      endRow: b.line,
      startCol: a.col,
      endCol: b.col,
    });
  }
  // Fusion verticale : la valeur de la cellule haute vaut pour chaque ligne de la plage (première
  // colonne seulement). Une fusion horizontale garde sa valeur dans la première cellule.
  for (const merge of sheet.merges) {
    if (merge.endRow === merge.startRow) continue;
    const value = byLine.get(merge.startRow)?.cells[merge.startCol] ?? null;
    if (value === null) continue;
    for (let line = merge.startRow + 1; line <= merge.endRow; line += 1) {
      const row = byLine.get(line) ?? { line, cells: [], notes: [] };
      row.cells[merge.startCol] = value;
      byLine.set(line, row);
    }
  }

  // Commentaires de cellules (notes).
  const rels = relationships(zip, path);
  for (const rel of rels.values()) {
    if (!rel.attrs.Type?.endsWith('/comments') || !rel.attrs.Target) continue;
    const commentsXml = zip.read(resolveTarget(path, rel.attrs.Target));
    if (!commentsXml) continue;
    const list = child(child(parseXml(commentsXml), 'comments'), 'commentList');
    for (const comment of childrenNamed(list, 'comment')) {
      const ref = parseCellRef(comment.attrs.ref ?? '');
      const text = textLimit(richText(child(comment, 'text')).trim());
      if (!ref || text === '') continue;
      const row = byLine.get(ref.line);
      if (row) row.notes[ref.col] = text;
      else sheet.comments.push({ line: ref.line, col: ref.col, text });
    }
  }

  sheet.rows = [...byLine.values()]
    .sort((x, y) => x.line - y.line)
    .map((row) => ({
      line: row.line,
      cells: Array.from({ length: sheet.columnCount }, (_, i) => row.cells[i] ?? null),
      notes: Array.from({ length: sheet.columnCount }, (_, i) => row.notes[i] ?? null),
    }));
  return sheet;
}

/** Lit toutes les feuilles d'un classeur .xlsx (valeurs, fusions, commentaires). */
export function readXlsx(buffer: Buffer): XlsxWorkbook {
  const zip = new ZipReader(buffer);
  if (!zip.has('[Content_Types].xml') || !zip.has('xl/workbook.xml')) {
    throw new XlsxReadError('Ce fichier n’est pas un classeur Excel .xlsx valide.');
  }
  if (zip.has('xl/vbaProject.bin')) {
    // Les macros ne sont jamais exécutées ; un classeur .xlsm n'est pas accepté pour autant.
    throw new XlsxReadError('Classeur avec macros refusé : enregistrez-le au format .xlsx.');
  }
  const workbook = child(parseXml(zip.read('xl/workbook.xml') ?? ''), 'workbook');
  const pr = child(workbook, 'workbookPr');
  const date1904 = pr?.attrs.date1904 === '1' || pr?.attrs.date1904 === 'true';
  const rels = relationships(zip, 'xl/workbook.xml');
  const sharedXml = zip.read('xl/sharedStrings.xml');
  const sharedStrings = sharedXml
    ? childrenNamed(child(parseXml(sharedXml), 'sst'), 'si').map((si) => textLimit(richText(si)))
    : [];
  const sheetNodes = childrenNamed(child(workbook, 'sheets'), 'sheet');
  if (sheetNodes.length === 0) throw new XlsxReadError('Le classeur ne contient aucune feuille.');
  if (sheetNodes.length > XLSX_LIMITS.maxSheets) {
    throw new XlsxReadError('Classeur trop complexe (20 feuilles au maximum).');
  }
  const sheets: XlsxSheet[] = [];
  for (const node of sheetNodes) {
    const rel = rels.get(node.attrs['r:id'] ?? node.attrs.id ?? '');
    const target = rel?.attrs.Target;
    // Feuilles graphiques ou introuvables : ignorées (aucune donnée tabulaire).
    if (!target || !rel.attrs.Type?.endsWith('/worksheet')) continue;
    sheets.push(
      readSheet(
        zip,
        resolveTarget('xl/workbook.xml', target),
        node.attrs.name ?? 'Feuille',
        (node.attrs.state ?? 'visible') !== 'visible',
        sharedStrings,
      ),
    );
  }
  if (sheets.length === 0)
    throw new XlsxReadError('Le classeur ne contient aucune feuille de calcul.');
  return { date1904, sheets };
}
