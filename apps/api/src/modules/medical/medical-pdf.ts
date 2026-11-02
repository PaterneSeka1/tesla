import { existsSync } from 'node:fs';
import { MEDICAL_FIELD_LABELS, type MedicalHolder, type MedicalRecordData } from '@tesla/shared';
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

/**
 * Fiche médicale imprimable (A4) aux couleurs de la communauté : en-tête au logo, titulaire,
 * contacts d'urgence, informations déclarées, date de mise à jour et mention de confidentialité.
 * Aucune zone de signature (non prévue par le formulaire, D137). Généré à la demande, jamais stocké.
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

  header(doc);
  const { holder, data } = record;
  section(doc, 'Titulaire');
  field(doc, 'Nom et prénoms', `${holder.lastName.toUpperCase()} ${holder.firstName}`);
  field(
    doc,
    'Date de naissance',
    holder.birthDate ? formatPdfDate(new Date(`${holder.birthDate}T00:00:00Z`)) : NOT_PROVIDED,
  );
  if (holder.matricule) field(doc, 'Matricule', holder.matricule);
  if (holder.team) field(doc, 'Équipe', holder.team);
  field(doc, MEDICAL_FIELD_LABELS.phone, data.phone || NOT_PROVIDED);

  section(doc, MEDICAL_FIELD_LABELS.emergencyContacts);
  if (data.emergencyContacts.length === 0) paragraph(doc, NOT_PROVIDED);
  data.emergencyContacts.forEach((contact, index) =>
    field(doc, `Contact ${index + 1}`, `${contact.name} (${contact.relation}) — ${contact.phone}`),
  );

  section(doc, 'Informations de santé déclarées');
  for (const key of [
    'allergies',
    'treatments',
    'emergencyInstructions',
    'precautions',
    'healthContact',
  ] as const) {
    field(doc, MEDICAL_FIELD_LABELS[key], data[key] || NOT_PROVIDED);
  }

  doc.moveDown(1);
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

function header(doc: Doc): void {
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
    .text(clean(COMMUNITY_DETAILS), { width: textWidth });
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

function field(doc: Doc, label: string, value: string): void {
  doc
    .moveDown(0.35)
    .fillColor(COLORS.gris)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(clean(label.toUpperCase()), MARGIN, doc.y, { width: width(doc), characterSpacing: 0.3 })
    .fillColor(COLORS.texte)
    .font('Helvetica')
    .fontSize(11)
    .text(clean(value), { width: width(doc) });
}

function paragraph(doc: Doc, text: string): void {
  doc
    .moveDown(0.35)
    .fillColor(COLORS.texte)
    .font('Helvetica')
    .fontSize(11)
    .text(clean(text), MARGIN, doc.y, { width: width(doc) });
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
