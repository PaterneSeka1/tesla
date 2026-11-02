import { existsSync } from 'node:fs';
import { type PracticalSheet, type PracticalSheetBlock } from '@tesla/shared';
import PDFDocument from 'pdfkit';
import {
  cleanPdfText as clean,
  COMMUNITY_DETAILS,
  COMMUNITY_NAME,
  LOGO_PATH,
  PDF_COLORS as COLORS,
  PDF_MARGIN as MARGIN,
} from '../../common/pdf-brand.js';

/**
 * Fiche pratique de l'Entreprise (A4) : modèle vierge à imprimer et à remplir à la main. En-tête au
 * logo et au nom de la communauté, rubriques, tableaux et cases à cocher ; source et pagination en
 * pied de page. Aucune donnée de projet ni de personne.
 */

type Doc = PDFKit.PDFDocument;

const BODY_SIZE = 10;
const CELL_PADDING = 4;
const ROW_HEIGHT = 22;

export function renderPracticalSheetPdf(
  sheet: PracticalSheet,
  options: { compress?: boolean } = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    compress: options.compress ?? true,
    margins: { top: MARGIN, bottom: MARGIN + 10, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: clean(`${sheet.title} — fiche pratique`),
      Author: COMMUNITY_NAME,
      Producer: 'Nikola Tesla Académie',
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  header(doc, sheet);
  for (const block of sheet.blocks) render(doc, block);
  footer(doc, sheet);
  doc.end();
  return done;
}

const width = (doc: Doc) => doc.page.width - MARGIN * 2;
const bottom = (doc: Doc) => doc.page.height - doc.page.margins.bottom;

function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > bottom(doc)) doc.addPage();
}

function header(doc: Doc, sheet: PracticalSheet): void {
  const top = MARGIN;
  const logo = existsSync(LOGO_PATH);
  if (logo) doc.image(LOGO_PATH, MARGIN, top, { width: 40, height: 40 });
  const textX = logo ? MARGIN + 50 : MARGIN;
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(COMMUNITY_NAME, textX, top + 4)
    .fillColor(COLORS.gris)
    .font('Helvetica')
    .fontSize(8.5)
    .text(`${COMMUNITY_DETAILS} · Fiche pratique de l’Entreprise`, textX);
  doc.y = top + 52;
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(doc.page.width - MARGIN, doc.y)
    .lineWidth(1.5)
    .strokeColor(COLORS.or)
    .stroke();
  doc.moveDown(0.8);
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(17)
    .text(clean(sheet.title), MARGIN, doc.y, { width: width(doc) })
    .moveDown(0.2)
    .fillColor(COLORS.texte)
    .font('Helvetica-Oblique')
    .fontSize(BODY_SIZE)
    .text(clean(sheet.purpose), { width: width(doc) })
    .moveDown(0.8);
}

function title(doc: Doc, value: string | undefined): void {
  if (!value) return;
  ensureSpace(doc, 50);
  doc
    .fillColor(COLORS.rouge)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(clean(value), MARGIN, doc.y, { width: width(doc) })
    .moveDown(0.3);
}

function render(doc: Doc, block: PracticalSheetBlock): void {
  doc.x = MARGIN;
  switch (block.kind) {
    case 'text':
      ensureSpace(doc, 30);
      doc
        .fillColor(COLORS.texte)
        .font('Helvetica')
        .fontSize(BODY_SIZE - 0.5)
        .text(clean(block.text), MARGIN, doc.y, { width: width(doc) })
        .moveDown(0.7);
      return;
    case 'fields':
      title(doc, block.title);
      for (const row of block.rows) field(doc, row.label, row.hint, row.lines ?? 1);
      doc.moveDown(0.5);
      return;
    case 'checklist':
      title(doc, block.title);
      for (const item of block.items) {
        ensureSpace(doc, ROW_HEIGHT);
        const y = doc.y;
        doc
          .rect(MARGIN, y + 1, 10, 10)
          .lineWidth(0.8)
          .strokeColor(COLORS.texte)
          .stroke();
        doc
          .fillColor(COLORS.texte)
          .font('Helvetica')
          .fontSize(BODY_SIZE)
          .text(clean(item), MARGIN + 18, y, { width: width(doc) - 18 });
        doc.y = Math.max(doc.y, y + 14) + 6;
      }
      doc.moveDown(0.5);
      return;
    case 'table':
      // Titre et premières lignes sur la même page.
      ensureSpace(doc, ROW_HEIGHT * 3 + (block.title ? 24 : 0));
      title(doc, block.title);
      table(doc, block);
      doc.moveDown(0.8);
  }
}

/** Rubrique : libellé, indication, puis lignes d'écriture. */
function field(doc: Doc, label: string, hint: string | undefined, lines: number): void {
  ensureSpace(doc, 16 + lines * ROW_HEIGHT);
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(BODY_SIZE)
    .text(clean(label), MARGIN, doc.y, { continued: !!hint, width: width(doc) });
  if (hint) {
    doc
      .fillColor(COLORS.gris)
      .font('Helvetica-Oblique')
      .text(clean(` — ${hint}`));
  }
  for (let line = 0; line < lines; line += 1) {
    const y = doc.y + ROW_HEIGHT - 6;
    doc
      .moveTo(MARGIN, y)
      .lineTo(doc.page.width - MARGIN, y)
      .lineWidth(0.5)
      .strokeColor(COLORS.gris)
      .dash(1.5, { space: 2 })
      .stroke()
      .undash();
    doc.y = y + 2;
  }
  doc.moveDown(0.4);
}

function table(doc: Doc, block: Extract<PracticalSheetBlock, { kind: 'table' }>): void {
  const weights = block.widths ?? block.columns.map(() => 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((weight) => (weight / sum) * width(doc));
  const rows: { cells: string[]; bold?: boolean }[] = [
    ...(block.rows ?? []).map((cells) => ({ cells })),
    ...Array.from({ length: block.blankRows ?? 0 }, () => ({ cells: [] as string[] })),
    ...(block.total ? [{ cells: [block.total], bold: true }] : []),
  ];
  const headerRow = () => row(doc, block.columns, widths, { header: true });
  ensureSpace(doc, ROW_HEIGHT * 3);
  headerRow();
  for (const item of rows) {
    if (doc.y + rowHeight(doc, item.cells, widths) > bottom(doc)) {
      doc.addPage();
      headerRow();
    }
    row(doc, item.cells, widths, { bold: item.bold });
  }
}

function rowHeight(doc: Doc, cells: string[], widths: number[]): number {
  // Mesure en gras (cas le plus large : en-tête et total).
  doc.font('Helvetica-Bold').fontSize(BODY_SIZE - 0.5);
  const heights = cells.map((cell, index) =>
    doc.heightOfString(clean(cell), { width: widths[index]! - CELL_PADDING * 2 }),
  );
  return Math.max(ROW_HEIGHT, ...heights.map((h) => h + CELL_PADDING * 2));
}

function row(
  doc: Doc,
  cells: string[],
  widths: number[],
  options: { header?: boolean; bold?: boolean },
): void {
  const y = doc.y;
  const height = rowHeight(doc, cells, widths);
  let x = MARGIN;
  widths.forEach((cellWidth, index) => {
    if (options.header) doc.rect(x, y, cellWidth, height).fill(COLORS.bordeaux);
    doc.rect(x, y, cellWidth, height).lineWidth(0.6).strokeColor(COLORS.gris).stroke();
    const value = cells[index];
    if (value) {
      doc
        .fillColor(options.header ? '#ffffff' : COLORS.texte)
        .font(options.header || options.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(BODY_SIZE - 0.5)
        .text(clean(value), x + CELL_PADDING, y + CELL_PADDING, {
          width: cellWidth - CELL_PADDING * 2,
        });
    }
    x += cellWidth;
  });
  doc.x = MARGIN;
  doc.y = y + height;
}

function footer(doc: Doc, sheet: PracticalSheet): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const y = doc.page.height - MARGIN + 6;
    // La marge basse est franchie volontairement : neutralisée le temps d'écrire le pied de page.
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor(COLORS.gris)
      .font('Helvetica')
      .fontSize(7.5)
      .text(clean(`Source : ${sheet.source}. Modèle vierge, à adapter.`), MARGIN, y, {
        width: width(doc) - 60,
        lineBreak: false,
      })
      .text(`${index + 1} / ${range.count}`, doc.page.width - MARGIN - 50, y, {
        width: 50,
        align: 'right',
        lineBreak: false,
      });
    doc.page.margins.bottom = margin;
  }
}
