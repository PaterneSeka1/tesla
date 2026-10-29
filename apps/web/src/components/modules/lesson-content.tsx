import {
  isSafeImageSrc,
  isSafeLinkHref,
  type LessonBlock,
  type LessonDocument,
  type LessonInline,
  type LessonListItem,
} from '@tesla/shared';
import { Fragment } from 'react';

/**
 * Rendu d'un contenu de leçon (document structuré validé par l'API) en éléments React.
 * Aucun HTML n'est interprété : seul le texte est affiché, et les adresses des liens et images
 * sont revérifiées ici (défense en profondeur).
 */
export function LessonContent({
  document,
  offlineImages,
}: {
  document: LessonDocument;
  offlineImages?: Record<string, string>;
}) {
  if (document.content.length === 0) {
    return <p className="text-muted-foreground italic">Leçon sans contenu.</p>;
  }
  return (
    <div className="lesson-content space-y-4 leading-relaxed">
      {renderBlocks(document.content, offlineImages)}
    </div>
  );
}

function renderBlocks(blocks: LessonBlock[], offlineImages?: Record<string, string>) {
  return blocks.map((block, index) => (
    <Block key={index} block={block} offlineImages={offlineImages} />
  ));
}

function Block({
  block,
  offlineImages,
}: {
  block: LessonBlock;
  offlineImages?: Record<string, string>;
}) {
  switch (block.type) {
    case 'paragraph':
      return <p>{renderInline(block.content)}</p>;
    case 'heading':
      return block.attrs.level === 2 ? (
        <h3 className="pt-2 text-xl font-semibold text-tesla-bordeaux">
          {renderInline(block.content)}
        </h3>
      ) : (
        <h4 className="pt-1 text-lg font-semibold text-tesla-rouge">
          {renderInline(block.content)}
        </h4>
      );
    case 'bulletList':
      return (
        <ul className="list-disc space-y-1 pl-6">{renderItems(block.content, offlineImages)}</ul>
      );
    case 'orderedList':
      return (
        <ol className="list-decimal space-y-1 pl-6" start={block.attrs?.start}>
          {renderItems(block.content, offlineImages)}
        </ol>
      );
    case 'blockquote':
      return (
        <blockquote className="space-y-2 border-l-4 border-tesla-or bg-tesla-sable/40 py-2 pr-3 pl-4 italic">
          {renderBlocks(block.content, offlineImages)}
        </blockquote>
      );
    case 'horizontalRule':
      return <hr className="border-tesla-or/60" />;
    case 'image':
      if (!isSafeImageSrc(block.attrs.src)) return null;
      if (offlineImages && !offlineImages[block.attrs.src])
        return <p>Image indisponible hors ligne.</p>;
      return (
        <figure className="space-y-1">
          {/* Image externe saisie par un rédacteur (hôte non connu à l'avance) : next/image exigerait une liste d'hôtes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={offlineImages?.[block.attrs.src] ?? block.attrs.src}
            alt={block.attrs.alt ?? ''}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="max-h-[28rem] w-auto max-w-full rounded-md border"
          />
          {block.attrs.alt && (
            <figcaption className="text-sm text-muted-foreground">{block.attrs.alt}</figcaption>
          )}
        </figure>
      );
  }
}

function renderItems(items: LessonListItem[], offlineImages?: Record<string, string>) {
  return items.map((item, index) => (
    <li key={index} className="[&>p]:inline">
      {renderBlocks(item.content, offlineImages)}
    </li>
  ));
}

function renderInline(nodes: LessonInline[] | undefined) {
  return nodes?.map((node, index) => {
    if (node.type === 'hardBreak') return <br key={index} />;
    let element: React.ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          element = <strong>{element}</strong>;
          break;
        case 'italic':
          element = <em>{element}</em>;
          break;
        case 'underline':
          element = <u>{element}</u>;
          break;
        case 'strike':
          element = <s>{element}</s>;
          break;
        case 'link':
          if (isSafeLinkHref(mark.attrs.href)) {
            element = (
              <a
                href={mark.attrs.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-tesla-rouge underline underline-offset-4"
              >
                {element}
              </a>
            );
          }
          break;
      }
    }
    return <Fragment key={index}>{element}</Fragment>;
  });
}
