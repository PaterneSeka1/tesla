import { lessonImageFileId } from '@tesla/shared';
import { env } from '@/lib/env';

/**
 * Adresse d'affichage d'une image de leçon. Une image stockée par Tesla est enregistrée sous son
 * chemin interne `/api/v1/module-files/:id` (relais même origine en production) ; en développement,
 * l'API peut être sur une autre origine : le chemin est alors rattaché à `NEXT_PUBLIC_API_URL`.
 * Le serveur contrôle l'accès à chaque lecture (redirection vers une URL signée courte).
 */
export function resolveImageSrc(src: string): string {
  if (!lessonImageFileId(src)) return src;
  return `${env.NEXT_PUBLIC_API_URL}${src.slice('/api/v1'.length)}`;
}
