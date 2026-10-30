import { fileURLToPath } from 'node:url';

/**
 * Identité visuelle commune des PDF générés par le serveur (A4, polices standard du lecteur PDF :
 * aucune police ni ressource distante).
 */
export const PDF_COLORS = {
  bordeaux: '#510d12',
  rouge: '#801e23',
  or: '#d9a45f',
  texte: '#222222',
  gris: '#666666',
};

export const PDF_MARGIN = 50;

export const COMMUNITY_NAME = 'Communauté Nikola Tesla';
export const COMMUNITY_DETAILS = 'Branche Route · District Requin de Sable · Abidjan';

/** Logo de la communauté (application web) : utilisé s'il est présent, sinon en-tête textuel. */
export const LOGO_PATH = fileURLToPath(
  new URL('../../../web/public/brand/logo-communaute.png', import.meta.url),
);

/** Caractères hors Windows-1252 (police standard) remplacés pour éviter un rendu illisible. */
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

export function cleanPdfText(text: string): string {
  return [...text]
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) return char;
      if (CP1252_EXTRA.has(char)) return char;
      if (char === '\t') return ' ';
      // Équivalents lisibles des signes typographiques courants hors Windows-1252.
      if (char === ' ' || char === ' ') return ' ';
      if (char === '→') return '->';
      return '?';
    })
    .join('');
}

export const formatPdfDate = (date: Date) =>
  date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
