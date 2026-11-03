import { existsSync } from 'node:fs';
import {
  MEDICAL_FIELD_LABELS,
  MEDICAL_RECORD_SECTIONS,
  type MedicalHolder,
  type MedicalRecordData,
} from '@tesla/shared';
import PDFDocument from 'pdfkit';
import {
  cleanPdfText as clean,
  COMMUNITY_DETAILS,
  COMMUNITY_NAME,
  formatPdfDate,
  LOGO_PATH,
  PDF_COLORS as COLORS,
  PDF_MARGIN as MARGIN,
} from '../../common/pdf-brand.js';

type Doc = PDFKit.PDFDocument;

export interface PrintableMedicalRecord {
  holder: MedicalHolder;
  data: MedicalRecordData;
  updatedAt: Date;
}

const NOT_PROVIDED = 'Non renseigné';
const [PERSONAL, CONTACTS, ...DECLARED] = MEDICAL_RECORD_SECTIONS;

/**
 * Fiche médicale imprimable (A4) aux couleurs de la communauté, dans l'ordre des quatre sections du
 * formulaire (`MEDICAL_RECORD_SECTIONS`) : informations personnelles, contacts d'urgence (encadré),
 * informations de santé, consignes complémentaires ; date de dernière modification en tête et en
 * pied. Aucune zone de signature (D137). Généré à la demande, jamais stocké.
 */
export function renderMedicalPdf(
  record: PrintableMedicalRecord,
  options: { compress?: boolean } = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    compress: options.compress ?? true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: 'Fiche médicale — confidentiel',
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

  const { holder, data } = record;
  header(doc, record.updatedAt);

  section(doc, PERSONAL.title);
  grid(doc, [
    ['Nom et prénoms', `${holder.lastName.toUpperCase()} ${holder.firstName}`],
    [
      'Date de naissance',
      holder.birthDate ? formatPdfDate(new Date(`${holder.birthDate}T00:00:00Z`)) : NOT_PROVIDED,
    ],
    ...(holder.matricule ? [['Matricule', holder.matricule] as const] : []),
    ...(holder.team ? [['Équipe', holder.team] as const] : []),
    [MEDICAL_FIELD_LABELS.phone, data.phone || NOT_PROVIDED],
  ]);

  section(doc, CONTACTS.title);
  emergencyBox(doc, data);

  for (const { title, fields } of DECLARED) {
    section(doc, title);
    for (const key of fields) field(doc, MEDICAL_FIELD_LABELS[key], data[key]);
  }

  doc.moveDown(1.2);
  doc
    .fillColor(COLORS.gris)
    .font('Helvetica-Oblique')
    .fontSize(9)
    .text(
      clean(
        `Dernière mise à jour : ${formatPdfDate(record.updatedAt)}. Informations déclarées volontairement par le titulaire, ` +
          'sous sa responsabilité, pour lui porter secours ou adapter une activité.',
      ),
      MARGIN,
      doc.y,
      { width: width(doc) },
    );
  footer(doc);
  doc.end();
  return done;
}

const width = (doc: Doc) => doc.page.width - 2 * MARGIN;

function header(doc: Doc, updatedAt: Date): void {
  const top = MARGIN;
  let textX = MARGIN;
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, MARGIN, top, { width: 56, height: 56 });
    textX = MARGIN + 70;
  }
  const textWidth = doc.page.width - MARGIN - textX;
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(COMMUNITY_NAME, textX, top + 4, { width: textWidth })
    .fillColor(COLORS.gris)
    .font('Helvetica')
    .fontSize(9)
    .text(clean(COMMUNITY_DETAILS), { width: textWidth })
    .text(clean(`Mise à jour le ${formatPdfDate(updatedAt)}`), { width: textWidth });
  doc.y = Math.max(doc.y, top + 60);
  doc
    .moveDown(0.6)
    .fillColor(COLORS.rouge)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('Fiche médicale', MARGIN, doc.y, { width: width(doc) })
    .fillColor(COLORS.gris)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text('DOCUMENT CONFIDENTIEL — À REMETTRE UNIQUEMENT AUX PERSONNES CHARGÉES DES SECOURS', {
      characterSpacing: 0.3,
    });
  rule(doc, COLORS.or, 2);
}

function section(doc: Doc, title: string): void {
  doc.moveDown(0.9);
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(12.5)
    .text(clean(title), MARGIN, doc.y, { width: width(doc) });
  rule(doc, COLORS.or, 0.75);
}

const label = (doc: Doc, text: string, x: number, y: number, w: number) =>
  doc
    .fillColor(COLORS.gris)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(clean(text.toUpperCase()), x, y, { width: w, characterSpacing: 0.3 });

/** Valeur déclarée ; « Non renseigné » en gris italique. */
const value = (doc: Doc, text: string, options: { width: number; x?: number; y?: number }) => {
  const missing = !text || text === NOT_PROVIDED;
  return doc
    .fillColor(missing ? COLORS.gris : COLORS.texte)
    .font(missing ? 'Helvetica-Oblique' : 'Helvetica')
    .fontSize(11)
    .text(clean(missing ? NOT_PROVIDED : text), options.x, options.y, { width: options.width });
};

/** Champs courts sur deux colonnes (identité). */
function grid(doc: Doc, entries: readonly (readonly [string, string])[]): void {
  const gap = 20;
  const columnWidth = (width(doc) - gap) / 2;
  for (let index = 0; index < entries.length; index += 2) {
    const top = doc.y + 6;
    let bottom = top;
    entries.slice(index, index + 2).forEach(([name, text], column) => {
      const x = MARGIN + column * (columnWidth + gap);
      label(doc, name, x, top, columnWidth);
      value(doc, text, { x, y: doc.y, width: columnWidth });
      bottom = Math.max(bottom, doc.y);
    });
    doc.y = bottom;
  }
  doc.x = MARGIN;
}

function field(doc: Doc, name: string, text: string): void {
  doc.moveDown(0.35);
  label(doc, name, MARGIN, doc.y, width(doc));
  value(doc, text, { x: MARGIN, y: doc.y, width: width(doc) });
}

/** Encadré des personnes à prévenir : numéros en gras, lisibles d'un coup d'œil. */
function emergencyBox(doc: Doc, data: MedicalRecordData): void {
  const padding = 10;
  const inner = width(doc) - 2 * padding - 4;
  const nameWidth = inner * 0.6;
  doc.font('Helvetica-Bold').fontSize(11);
  const rows = data.emergencyContacts.map((contact) => {
    const who = clean(`${contact.name} (${contact.relation})`);
    return {
      who,
      phone: clean(contact.phone),
      height: doc.heightOfString(who, { width: nameWidth }) + 8,
    };
  });
  doc.font('Helvetica').fontSize(11);
  const healthHeight = doc.heightOfString(clean(data.healthContact || NOT_PROVIDED), {
    width: inner,
  });
  const rowsHeight = rows.length ? rows.reduce((sum, row) => sum + row.height, 0) : 20;
  const height = padding * 2 + rowsHeight + 16 + healthHeight;
  if (doc.y + 8 + height > doc.page.height - MARGIN) doc.addPage();
  const boxTop = doc.y + 8;
  doc.rect(MARGIN, boxTop, width(doc), height).fill(COLORS.sable);
  doc.rect(MARGIN, boxTop, 4, height).fill(COLORS.rouge);

  const x = MARGIN + 4 + padding;
  let y = boxTop + padding;
  if (rows.length === 0) {
    value(doc, NOT_PROVIDED, { x, y, width: inner });
    y += 20;
  }
  for (const row of rows) {
    doc
      .fillColor(COLORS.texte)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(row.who, x, y, { width: nameWidth });
    doc
      .fillColor(COLORS.bordeaux)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(row.phone, x + nameWidth, y - 1, { width: inner - nameWidth, align: 'right' });
    y += row.height;
  }
  label(doc, MEDICAL_FIELD_LABELS.healthContact, x, y + 2, inner);
  value(doc, data.healthContact, { x, y: doc.y, width: inner });
  doc.y = boxTop + height;
  doc.x = MARGIN;
}

function rule(doc: Doc, color: string, lineWidth: number): void {
  const y = doc.y + 4;
  doc
    .moveTo(MARGIN, y)
    .lineTo(doc.page.width - MARGIN, y)
    .lineWidth(lineWidth)
    .strokeColor(color)
    .stroke();
  doc.y = y + 6;
}

/** Pied de page sur chaque page : confidentialité et pagination. */
function footer(doc: Doc): void {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const y = doc.page.height - MARGIN + 14;
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor(COLORS.gris)
      .font('Helvetica')
      .fontSize(8)
      .text(
        clean(
          `${COMMUNITY_NAME} · Fiche médicale confidentielle · Page ${index + 1} / ${range.count}`,
        ),
        MARGIN,
        y,
        { width: width(doc), align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
}
