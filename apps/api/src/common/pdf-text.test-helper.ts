// Utilitaire de test : extraction du texte d'un PDF pdfkit (aucun usage en production).
import { inflateSync } from 'node:zlib';

/** Texte affiché d'un PDF pdfkit : flux décompressés, chaînes hexadécimales des opérateurs TJ. */
export function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  let text = '';
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1]!, 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const array of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const hex of array[1]!.matchAll(/<([0-9a-fA-F]*)>/g)) {
        text += Buffer.from(hex[1]!, 'hex').toString('latin1');
      }
      text += '\n';
    }
  }
  return text;
}
