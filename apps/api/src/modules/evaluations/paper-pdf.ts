import { existsSync } from 'node:fs';
import {
  isObjectiveQuestion,
  PAPER_DOCUMENT_LABELS,
  type PaperDocument,
  QUESTION_TYPE_LABELS,
  SCORING_POLICY_LABELS,
} from '@tesla/shared';
import PDFDocument from 'pdfkit';
import {
  cleanPdfText,
  formatPdfDate,
  LOGO_PATH,
  PDF_COLORS,
  PDF_MARGIN,
} from '../../common/pdf-brand.js';
import { type PaperDocumentData } from './evaluation-attempts.service.js';

/**
 * Génération serveur des documents papier (A4, paginés, polices standard intégrées au lecteur PDF :
 * aucune police ni ressource distante, adapté au VPS). Trois documents distincts :
 * questionnaire du routier (jamais de bonne réponse ni de barème), corrigé et grille de correction
 * (chefs et responsable, contrôle d'accès dans le service).
 */

const COLORS = PDF_COLORS;
const MARGIN = PDF_MARGIN;
const clean = cleanPdfText;
const formatDate = formatPdfDate;

const formatPoints = (value: number) =>
  `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt${value > 1 ? 's' : ''}`;

export function renderPaperDocument(
  data: PaperDocumentData,
  document: PaperDocument,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN + 10, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: clean(`${PAPER_DOCUMENT_LABELS[document]} — ${data.evaluationTitle} — ${data.code}`),
      Author: 'Communauté Nikola Tesla',
      Producer: 'Nikola Tesla Académie',
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  header(doc, data, document);
  if (document === 'questionnaire') questionnaire(doc, data);
  else if (document === 'corrige') answerKey(doc, data);
  else gradingGrid(doc, data);
  footer(doc, data, document);
  doc.end();
  return done;
}

type Doc = PDFKit.PDFDocument;

const width = (doc: Doc) => doc.page.width - MARGIN * 2;

/** Saut de page si la hauteur demandée ne tient plus. */
function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > doc.page.height - MARGIN - 20) doc.addPage();
}

function header(doc: Doc, data: PaperDocumentData, document: PaperDocument): void {
  const top = MARGIN;
  let textX = MARGIN;
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, MARGIN, top, { width: 48, height: 48 });
    textX += 60;
  }
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('Communauté Nikola Tesla', textX, top + 4)
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.gris)
    .text('Branche Route · District Requin de Sable · Abidjan', textX, top + 22)
    .text('Nikola Tesla Académie', textX, top + 34);

  // Code de tentative, encadré en haut à droite (recherche de la copie par les chefs).
  const boxWidth = 150;
  const boxX = doc.page.width - MARGIN - boxWidth;
  doc.roundedRect(boxX, top, boxWidth, 44, 4).lineWidth(1).strokeColor(COLORS.bordeaux).stroke();
  doc
    .fillColor(COLORS.gris)
    .fontSize(8)
    .text('Code de tentative', boxX, top + 7, { width: boxWidth, align: 'center' })
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(data.code, boxX, top + 20, { width: boxWidth, align: 'center' });

  doc
    .moveTo(MARGIN, top + 58)
    .lineTo(doc.page.width - MARGIN, top + 58)
    .lineWidth(2)
    .strokeColor(COLORS.or)
    .stroke();
  doc.x = MARGIN;
  doc.y = top + 70;

  doc
    .fillColor(COLORS.rouge)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(clean(PAPER_DOCUMENT_LABELS[document]).toUpperCase(), { characterSpacing: 0.5 });
  if (document !== 'questionnaire') {
    doc
      .fillColor(COLORS.rouge)
      .font('Helvetica')
      .fontSize(9)
      .text(
        'Document réservé aux chefs et au responsable pédagogique — ne pas remettre au routier.',
      );
  }
  doc.moveDown(0.3);
  if (data.moduleTitle) {
    doc
      .fillColor(COLORS.gris)
      .font('Helvetica')
      .fontSize(10)
      .text(clean(`Module : ${data.moduleTitle}`));
  }
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(clean(data.evaluationTitle));
  doc
    .fillColor(COLORS.gris)
    .font('Helvetica')
    .fontSize(9)
    .text(
      `${data.evaluationCode} · version ${data.version} · préparée le ${formatDate(data.preparedAt)}`,
    );
  doc.moveDown(0.8);
}

function identity(doc: Doc, data: PaperDocumentData): void {
  const rows: [string, string][] = [
    ['Nom et prénoms', `${data.scout.lastName.toUpperCase()} ${data.scout.firstName}`],
    ['Matricule', data.scout.matricule ?? '—'],
    ['Équipe', data.teamName ?? '—'],
    ['Date', data.plannedFor ? formatDate(data.plannedFor) : '____ / ____ / ________'],
  ];
  const startY = doc.y;
  const height = rows.length * 18 + 12;
  doc
    .rect(MARGIN, startY, width(doc), height)
    .fillColor('#f2e0c3')
    .fillOpacity(0.35)
    .fill()
    .fillOpacity(1);
  rows.forEach(([label, value], index) => {
    const y = startY + 8 + index * 18;
    doc
      .fillColor(COLORS.gris)
      .font('Helvetica')
      .fontSize(9)
      .text(label, MARGIN + 10, y, { width: 110 });
    doc
      .fillColor(COLORS.texte)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(clean(value), MARGIN + 125, y - 1, {
        width: width(doc) - 135,
      });
  });
  doc.x = MARGIN;
  doc.y = startY + height + 14;
}

function instructions(doc: Doc, data: PaperDocumentData): void {
  if (!data.instructions.trim()) return;
  doc.fillColor(COLORS.bordeaux).font('Helvetica-Bold').fontSize(11).text('Consignes');
  doc
    .fillColor(COLORS.texte)
    .font('Helvetica')
    .fontSize(10)
    .text(clean(data.instructions), { align: 'justify' });
  doc.moveDown(0.8);
}

function questionTitle(doc: Doc, index: number, prompt: string, suffix?: string): void {
  ensureSpace(doc, 60);
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Question ${index + 1}${suffix ? `  —  ${suffix}` : ''}`);
  doc.fillColor(COLORS.texte).font('Helvetica').fontSize(11).text(clean(prompt), { align: 'left' });
  doc.moveDown(0.4);
}

/** Case à cocher dessinée (aucun glyphe hors police standard). */
function checkbox(doc: Doc, x: number, y: number, checked: boolean): void {
  doc
    .rect(x, y + 1, 10, 10)
    .lineWidth(0.8)
    .strokeColor(COLORS.texte)
    .stroke();
  if (checked) {
    doc
      .moveTo(x + 2, y + 6)
      .lineTo(x + 4.5, y + 9)
      .lineTo(x + 9, y + 2.5)
      .lineWidth(1.6)
      .strokeColor(COLORS.rouge)
      .stroke();
  }
}

function answerLines(doc: Doc, count: number): void {
  for (let line = 0; line < count; line += 1) {
    ensureSpace(doc, 22);
    const y = doc.y + 18;
    doc
      .moveTo(MARGIN, y)
      .lineTo(doc.page.width - MARGIN, y)
      .lineWidth(0.5)
      .strokeColor('#b5b5b5')
      .stroke();
    doc.y = y + 4;
  }
  doc.x = MARGIN;
}

function questionnaire(doc: Doc, data: PaperDocumentData): void {
  identity(doc, data);
  instructions(doc, data);
  doc
    .fillColor(COLORS.gris)
    .font('Helvetica-Oblique')
    .fontSize(9)
    .text(
      `${data.questions.length} question${data.questions.length > 1 ? 's' : ''}. Cochez la ou les cases correspondant à votre réponse ; rédigez lisiblement les réponses libres.`,
    );
  doc.moveDown(0.8);

  data.questions.forEach((question, index) => {
    const hint =
      question.type === 'CHOIX_MULTIPLE'
        ? 'plusieurs réponses possibles'
        : question.type === 'CHOIX_UNIQUE'
          ? 'une seule réponse'
          : question.type === 'VRAI_FAUX'
            ? 'vrai ou faux'
            : undefined;
    questionTitle(doc, index, question.prompt, hint);
    if (isObjectiveQuestion(question.type)) {
      for (const option of question.options) {
        ensureSpace(doc, 20);
        const y = doc.y;
        checkbox(doc, MARGIN + 8, y, false);
        doc
          .fillColor(COLORS.texte)
          .font('Helvetica')
          .fontSize(10.5)
          .text(clean(option.label), MARGIN + 26, y, {
            width: width(doc) - 26,
          });
        doc.moveDown(0.3);
      }
    } else {
      answerLines(doc, question.type === 'REPONSE_COURTE' ? 3 : 10);
    }
    doc.x = MARGIN;
    doc.moveDown(0.9);
  });
}

function answerKey(doc: Doc, data: PaperDocumentData): void {
  instructions(doc, data);
  const total = data.questions.reduce((sum, question) => sum + (question.points ?? 0), 0);
  doc
    .fillColor(COLORS.texte)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(`Barème total : ${formatPoints(total)}`);
  doc.moveDown(0.8);

  data.questions.forEach((question, index) => {
    const points = question.points ?? 0;
    const policy =
      question.type === 'CHOIX_MULTIPLE'
        ? ` · ${SCORING_POLICY_LABELS[question.scoringPolicy]}`
        : '';
    questionTitle(
      doc,
      index,
      question.prompt,
      `${QUESTION_TYPE_LABELS[question.type]} · ${formatPoints(points)}${policy}`,
    );
    if (isObjectiveQuestion(question.type)) {
      for (const option of question.options) {
        ensureSpace(doc, 20);
        const y = doc.y;
        checkbox(doc, MARGIN + 8, y, option.isCorrect === true);
        doc
          .fillColor(option.isCorrect ? COLORS.rouge : COLORS.texte)
          .font(option.isCorrect ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(10.5)
          .text(
            clean(option.label + (option.isCorrect ? '   (bonne réponse)' : '')),
            MARGIN + 26,
            y,
            {
              width: width(doc) - 26,
            },
          );
        doc.moveDown(0.3);
      }
    }
    if (question.expectedAnswer) {
      doc.x = MARGIN;
      doc.fillColor(COLORS.bordeaux).font('Helvetica-Bold').fontSize(9.5).text('Réponse attendue');
      doc
        .fillColor(COLORS.texte)
        .font('Helvetica')
        .fontSize(10)
        .text(clean(question.expectedAnswer));
    }
    if (question.guidance) {
      doc.x = MARGIN;
      doc
        .fillColor(COLORS.bordeaux)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('Critères de correction');
      doc.fillColor(COLORS.texte).font('Helvetica').fontSize(10).text(clean(question.guidance));
    }
    doc.x = MARGIN;
    doc.moveDown(0.9);
  });
}

function gradingGrid(doc: Doc, data: PaperDocumentData): void {
  identity(doc, data);
  const columns = [
    { label: 'N°', width: 30 },
    { label: 'Type', width: 105 },
    { label: 'Barème', width: 60 },
    { label: 'Points obtenus', width: 75 },
    { label: 'Appréciation', width: 0 },
  ];
  columns[4]!.width =
    width(doc) - columns.slice(0, 4).reduce((sum, column) => sum + column.width, 0);
  const rowHeight = 26;

  const drawRow = (cells: string[], bold = false) => {
    ensureSpace(doc, rowHeight);
    const y = doc.y;
    let x = MARGIN;
    cells.forEach((cell, index) => {
      const column = columns[index]!;
      doc.rect(x, y, column.width, rowHeight).lineWidth(0.6).strokeColor('#999999').stroke();
      doc
        .fillColor(COLORS.texte)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .text(clean(cell), x + 4, y + 9, {
          width: column.width - 8,
          lineBreak: false,
          ellipsis: true,
        });
      x += column.width;
    });
    doc.x = MARGIN;
    doc.y = y + rowHeight;
  };

  drawRow(
    columns.map((column) => column.label),
    true,
  );
  let total = 0;
  data.questions.forEach((question, index) => {
    const points = question.points ?? 0;
    total += points;
    drawRow([String(index + 1), QUESTION_TYPE_LABELS[question.type], formatPoints(points), '', '']);
  });
  drawRow(['', 'Total', formatPoints(total), '', ''], true);

  doc.moveDown(1.2);
  const box = (label: string, height: number) => {
    ensureSpace(doc, height + 20);
    doc.fillColor(COLORS.bordeaux).font('Helvetica-Bold').fontSize(10).text(label);
    const y = doc.y + 4;
    doc.rect(MARGIN, y, width(doc), height).lineWidth(0.6).strokeColor('#999999').stroke();
    doc.y = y + height + 12;
    doc.x = MARGIN;
  };
  box('Appréciation générale', 50);
  box('Observations du correcteur', 80);
  ensureSpace(doc, 60);
  doc.fillColor(COLORS.texte).font('Helvetica').fontSize(10);
  doc.text('Nom du correcteur : ______________________________________________');
  doc.moveDown(0.8);
  doc.text('Date de correction : ____ / ____ / ________          Signature : ____________________');
  doc.moveDown(1);
  doc
    .fillColor(COLORS.gris)
    .font('Helvetica-Oblique')
    .fontSize(8.5)
    .text(
      'La note reportée ici est une correction : elle ne vaut ni validation officielle d’un acquis ni passage d’étape, décisions réservées au responsable pédagogique.',
    );
}

function footer(doc: Doc, data: PaperDocumentData, document: PaperDocument): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor(COLORS.gris)
      .font('Helvetica')
      .fontSize(8)
      .text(
        clean(
          `${data.code} · ${PAPER_DOCUMENT_LABELS[document]} · page ${index + 1} / ${range.count}`,
        ),
        MARGIN,
        doc.page.height - MARGIN + 5,
        { width: width(doc), align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
}
