import { existsSync } from 'node:fs';
import {
  isSafeLinkHref,
  type LessonBlock,
  type LessonInline,
  type PrintableModule,
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

/**
 * Support de cours téléchargeable (A4) : page de garde au logo et au nom de la communauté, une leçon
 * par page, en-tête (logo, communauté, module) et pied de page (code, version, pagination) sur chaque
 * page de contenu. Contenu de la version publiée uniquement ; un module ne contient aucun corrigé.
 * Les images (URL externes) ne sont pas téléchargées par le serveur : leur légende et leur adresse
 * sont imprimées.
 */

type Doc = PDFKit.PDFDocument;

/** Hauteur réservée à l'en-tête des pages de contenu. */
const HEADER_HEIGHT = 44;
const BODY_SIZE = 10.5;

export function renderModulePdf(
  module: PrintableModule,
  options: { compress?: boolean } = {},
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    compress: options.compress ?? true,
    margins: {
      top: MARGIN + HEADER_HEIGHT,
      bottom: MARGIN + 10,
      left: MARGIN,
      right: MARGIN,
    },
    bufferPages: true,
    info: {
      Title: clean(`${module.title} — ${module.code}`),
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

  cover(doc, module);
  module.lessons.forEach((lesson, index) => {
    doc.addPage();
    doc
      .fillColor(COLORS.rouge)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`LEÇON ${index + 1} / ${module.lessons.length}`, { characterSpacing: 0.5 });
    doc.fillColor(COLORS.bordeaux).font('Helvetica-Bold').fontSize(17).text(clean(lesson.title));
    rule(doc, COLORS.or, 1.5);
    blocks(doc, lesson.content.content, 0);
    if (lesson.resources.length > 0) resources(doc, 'Ressources de la leçon', lesson.resources);
  });
  if (module.resources.length > 0) {
    doc.addPage();
    resources(doc, 'Ressources du module', module.resources);
  }
  frame(doc, module);
  doc.end();
  return done;
}

const width = (doc: Doc) => doc.page.width - MARGIN * 2;

function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function rule(doc: Doc, color: string, lineWidth: number): void {
  doc.moveDown(0.3);
  const y = doc.y;
  doc
    .moveTo(MARGIN, y)
    .lineTo(doc.page.width - MARGIN, y)
    .lineWidth(lineWidth)
    .strokeColor(color)
    .stroke();
  doc.x = MARGIN;
  doc.y = y + 10;
}

// ─── Page de garde ─────────────────────────────────────────────────────────

function cover(doc: Doc, module: PrintableModule): void {
  const center = { width: width(doc), align: 'center' as const };
  let y = MARGIN + 30;
  if (existsSync(LOGO_PATH)) {
    const size = 110;
    doc.image(LOGO_PATH, (doc.page.width - size) / 2, y, { width: size, height: size });
    y += size + 18;
  }
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(COMMUNITY_NAME, MARGIN, y, center)
    .moveDown(0.2)
    .fillColor(COLORS.gris)
    .font('Helvetica')
    .fontSize(10)
    .text(COMMUNITY_DETAILS, center)
    .text('Nikola Tesla Académie · Support de cours', center);
  doc.moveDown(1.2);
  rule(doc, COLORS.or, 2);
  doc.moveDown(1);
  doc
    .fillColor(COLORS.bordeaux)
    .font('Helvetica-Bold')
    .fontSize(24)
    .text(clean(module.title), MARGIN, doc.y, center)
    .moveDown(0.4);
  const facts = [
    module.stage ? `Étape recommandée : ${module.stage.name}` : 'Toutes les étapes',
    module.theme,
    `${module.lessons.length} leçon${module.lessons.length > 1 ? 's' : ''}`,
  ].filter(Boolean);
  doc
    .fillColor(COLORS.rouge)
    .font('Helvetica')
    .fontSize(11)
    .text(clean(facts.join(' · ')), center)
    .fillColor(COLORS.gris)
    .fontSize(9)
    .text(
      `${module.code} · version ${module.version} · publiée le ${formatPdfDate(new Date(module.publishedAt))}`,
      center,
    );
  doc.moveDown(1.5);
  if (module.summary) {
    doc
      .fillColor(COLORS.texte)
      .font('Helvetica-Oblique')
      .fontSize(BODY_SIZE + 0.5)
      .text(clean(module.summary), center);
    doc.moveDown(1);
  }
  doc.x = MARGIN;
  if (module.objectives.length > 0) {
    section(doc, 'Objectifs pédagogiques');
    list(doc, module.objectives);
  }
  if (module.prerequisites) {
    section(doc, 'Prérequis');
    doc.fillColor(COLORS.texte).font('Helvetica').fontSize(BODY_SIZE);
    doc.text(clean(module.prerequisites), MARGIN, doc.y, { width: width(doc) });
    doc.moveDown(0.6);
  }
  section(doc, 'Sommaire');
  module.lessons.forEach((lesson, index) => {
    doc
      .fillColor(COLORS.texte)
      .font('Helvetica')
      .fontSize(BODY_SIZE)
      .text(clean(`${index + 1}. ${lesson.title}`), MARGIN + 10, doc.y, {
        width: width(doc) - 10,
      });
  });
}

function section(doc: Doc, title: string): void {
  ensureSpace(doc, 50);
  doc.x = MARGIN;
  doc.fillColor(COLORS.bordeaux).font('Helvetica-Bold').fontSize(12).text(title);
  doc.moveDown(0.3);
}

function list(doc: Doc, items: string[]): void {
  for (const item of items) {
    const y = doc.y;
    doc
      .fillColor(COLORS.or)
      .font('Helvetica-Bold')
      .fontSize(BODY_SIZE)
      .text('•', MARGIN + 6, y);
    doc
      .fillColor(COLORS.texte)
      .font('Helvetica')
      .text(clean(item), MARGIN + 20, y, { width: width(doc) - 20 });
    doc.moveDown(0.15);
  }
  doc.x = MARGIN;
  doc.moveDown(0.6);
}

// ─── Contenu des leçons (liste blanche de `lessonDocumentSchema`) ──────────

function blocks(doc: Doc, content: readonly LessonBlock[], indent: number): void {
  for (const block of content) blockNode(doc, block, indent);
}

function blockNode(doc: Doc, block: LessonBlock, indent: number): void {
  const x = MARGIN + indent;
  const w = width(doc) - indent;
  switch (block.type) {
    case 'heading': {
      const level2 = block.attrs.level === 2;
      ensureSpace(doc, 50);
      doc.moveDown(0.4);
      inline(doc, block.content ?? [], {
        x,
        width: w,
        size: level2 ? 14 : 12,
        color: level2 ? COLORS.bordeaux : COLORS.rouge,
        bold: true,
      });
      doc.moveDown(0.25);
      break;
    }
    case 'paragraph':
      ensureSpace(doc, 20);
      inline(doc, block.content ?? [], { x, width: w, size: BODY_SIZE, color: COLORS.texte });
      doc.moveDown(0.45);
      break;
    case 'bulletList':
    case 'orderedList': {
      const start = block.type === 'orderedList' ? (block.attrs?.start ?? 1) : 1;
      block.content.forEach((item, index) => {
        ensureSpace(doc, 20);
        const y = doc.y;
        const marker = block.type === 'orderedList' ? `${start + index}.` : '•';
        doc
          .fillColor(block.type === 'orderedList' ? COLORS.rouge : COLORS.or)
          .font('Helvetica-Bold')
          .fontSize(BODY_SIZE)
          .text(marker, x + 4, y, { width: 16, lineBreak: false });
        doc.x = x + 20;
        doc.y = y;
        // Paragraphes d'un élément de liste sans espacement supplémentaire.
        item.content.forEach((child) => {
          if (child.type === 'paragraph') {
            inline(doc, child.content ?? [], {
              x: x + 20,
              width: w - 20,
              size: BODY_SIZE,
              color: COLORS.texte,
            });
            doc.moveDown(0.15);
          } else blockNode(doc, child, indent + 20);
        });
      });
      doc.x = MARGIN;
      doc.moveDown(0.35);
      break;
    }
    case 'blockquote': {
      ensureSpace(doc, 30);
      const page = doc.bufferedPageRange().count;
      const top = doc.y;
      for (const child of block.content) {
        if (child.type === 'paragraph') {
          inline(doc, child.content ?? [], {
            x: x + 14,
            width: w - 14,
            size: BODY_SIZE,
            color: COLORS.bordeaux,
            italic: true,
          });
          doc.moveDown(0.2);
        } else blockNode(doc, child, indent + 14);
      }
      // Filet vertical, si la citation tient sur une seule page.
      if (doc.bufferedPageRange().count === page) {
        doc
          .moveTo(x + 4, top)
          .lineTo(x + 4, doc.y - 4)
          .lineWidth(2.5)
          .strokeColor(COLORS.or)
          .stroke();
      }
      doc.x = MARGIN;
      doc.moveDown(0.4);
      break;
    }
    case 'horizontalRule':
      rule(doc, '#cccccc', 0.6);
      break;
    case 'image':
      ensureSpace(doc, 30);
      doc
        .fillColor(COLORS.gris)
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text(
          clean(
            `[Illustration${block.attrs.alt ? ` : ${block.attrs.alt}` : ''}] ${block.attrs.src}`,
          ),
          x,
          doc.y,
          { width: w },
        );
      doc.moveDown(0.45);
      break;
  }
}

/** Texte enrichi : gras, italique, souligné, barré, liens ; segments enchaînés sur la même ligne. */
function inline(
  doc: Doc,
  nodes: readonly LessonInline[],
  style: {
    x: number;
    width: number;
    size: number;
    color: string;
    bold?: boolean;
    italic?: boolean;
  },
): void {
  const segments = nodes.map((node) =>
    node.type === 'hardBreak'
      ? { text: '\n', marks: [] }
      : { text: node.text, marks: node.marks ?? [] },
  );
  if (segments.length === 0) {
    doc.moveDown(0.3);
    return;
  }
  segments.forEach((segment, index) => {
    const has = (type: string) => segment.marks.some((mark) => mark.type === type);
    const bold = style.bold || has('bold');
    const italic = style.italic || has('italic');
    const link = segment.marks.find((mark) => mark.type === 'link');
    const href = link?.type === 'link' && isSafeLinkHref(link.attrs.href) ? link.attrs.href : null;
    doc
      .font(
        bold && italic
          ? 'Helvetica-BoldOblique'
          : bold
            ? 'Helvetica-Bold'
            : italic
              ? 'Helvetica-Oblique'
              : 'Helvetica',
      )
      .fontSize(style.size)
      .fillColor(href ? COLORS.rouge : style.color);
    const options = {
      width: style.width,
      continued: index < segments.length - 1,
      underline: has('underline') || href !== null,
      strike: has('strike'),
      link: href,
      lineGap: 2,
    };
    if (index === 0) doc.text(clean(segment.text), style.x, doc.y, options);
    else doc.text(clean(segment.text), options);
  });
  doc.x = MARGIN;
}

function resources(doc: Doc, title: string, items: PrintableModule['resources']): void {
  doc.moveDown(0.5);
  section(doc, title);
  for (const resource of items) {
    ensureSpace(doc, 30);
    doc
      .fillColor(COLORS.texte)
      .font('Helvetica-Bold')
      .fontSize(BODY_SIZE)
      .text(clean(resource.title), MARGIN, doc.y, { width: width(doc) });
    if (resource.description) {
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .text(clean(resource.description), { width: width(doc) });
    }
    doc
      .fillColor(COLORS.rouge)
      .font('Helvetica')
      .fontSize(9)
      .text(clean(resource.url), { width: width(doc), link: resource.url, underline: true });
    doc.moveDown(0.4);
  }
}

// ─── En-tête et pied de page ───────────────────────────────────────────────

/** En-tête (sauf page de garde) et pied de page de chaque page, après la mise en page. */
function frame(doc: Doc, module: PrintableModule): void {
  const range = doc.bufferedPageRange();
  const logo = existsSync(LOGO_PATH);
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const { top, bottom } = doc.page.margins;
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;
    if (index > 0) {
      let textX = MARGIN;
      if (logo) {
        doc.image(LOGO_PATH, MARGIN, MARGIN - 18, { width: 28, height: 28 });
        textX += 36;
      }
      doc
        .fillColor(COLORS.bordeaux)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(COMMUNITY_NAME, textX, MARGIN - 14, { lineBreak: false })
        .fillColor(COLORS.gris)
        .font('Helvetica')
        .fontSize(8)
        .text('Branche Route · Nikola Tesla Académie', textX, MARGIN - 1, { lineBreak: false });
      doc
        .fillColor(COLORS.gris)
        .fontSize(8)
        .text(clean(module.title), MARGIN + 220, MARGIN - 8, {
          width: width(doc) - 220,
          align: 'right',
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .moveTo(MARGIN, MARGIN + 16)
        .lineTo(doc.page.width - MARGIN, MARGIN + 16)
        .lineWidth(1)
        .strokeColor(COLORS.or)
        .stroke();
    }
    doc
      .fillColor(COLORS.gris)
      .font('Helvetica')
      .fontSize(8)
      .text(
        clean(
          `${COMMUNITY_NAME} · ${module.code} · version ${module.version} · page ${index + 1} / ${range.count}`,
        ),
        MARGIN,
        doc.page.height - MARGIN + 5,
        { width: width(doc), align: 'center', lineBreak: false },
      );
    doc.page.margins.top = top;
    doc.page.margins.bottom = bottom;
  }
}
