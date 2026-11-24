/**
 * Accueil des apprenants (D199) : une seule aventure principale et au plus une suggestion,
 * choisies par des règles fixes et explicables (aucune IA, aucune suggestion de remplissage).
 *
 * Aventure principale, par priorité :
 * 1. rattrapage dont l'échéance approche ou est dépassée (exigence officielle, D192) ;
 * 2. leçon interrompue (reprise en une action) ;
 * 3. rattrapage en cours sans alerte ;
 * 4. premier module recommandé pour l'étape ;
 * 5. exploration de la bibliothèque.
 * Suggestion : notions à revoir aujourd'hui, sinon un défi court s'il existe du contenu.
 */
export interface HomeInput {
  catchUp: {
    active: boolean;
    deadline: 'PROCHE' | 'DEPASSEE' | null;
    stageName: string | null;
  } | null;
  lastReading: {
    slug: string;
    moduleTitle: string;
    lessonId: string;
    lessonTitle: string;
    position?: number;
    count?: number;
  } | null;
  recommended: { slug: string; title: string } | null;
  dueReviews: number;
  hasPractice: boolean;
}

export interface Adventure {
  kind: 'catchup' | 'resume' | 'start' | 'explore';
  eyebrow: string;
  title: string;
  detail: string | null;
  href: string;
  cta: string;
  urgent?: boolean;
}

export interface Suggestion {
  title: string;
  href: string;
}

export function nextAdventure(input: HomeInput): Adventure {
  const catchUp = input.catchUp?.active ? input.catchUp : null;
  const catchUpAdventure = (urgent: boolean): Adventure => ({
    kind: 'catchup',
    eyebrow:
      catchUp?.deadline === 'DEPASSEE'
        ? 'Échéance dépassée'
        : catchUp?.deadline === 'PROCHE'
          ? 'Échéance proche'
          : 'Rattrapage en cours',
    title: catchUp?.stageName ? `Rattrapage : ${catchUp.stageName}` : 'Rattrapage',
    detail: null,
    href: '/mes-rattrapages',
    cta: 'Voir mon rattrapage',
    urgent,
  });
  if (catchUp?.deadline) return catchUpAdventure(true);
  const last = input.lastReading;
  if (last)
    return {
      kind: 'resume',
      eyebrow: 'Prêt à reprendre la Route ?',
      title: last.moduleTitle,
      detail:
        last.position && last.count
          ? `Halte ${last.position} sur ${last.count} · ${last.lessonTitle}`
          : last.lessonTitle,
      href: `/modules/${last.slug}/lecons/${last.lessonId}`,
      cta: 'Continuer mon aventure',
    };
  if (catchUp) return catchUpAdventure(false);
  if (input.recommended)
    return {
      kind: 'start',
      eyebrow: 'Prêt pour la suite de l’aventure ?',
      title: input.recommended.title,
      detail: null,
      href: `/modules/${input.recommended.slug}`,
      cta: 'Commencer',
    };
  return {
    kind: 'explore',
    eyebrow: 'Prêt pour la suite de l’aventure ?',
    title: 'Choisissez une destination',
    detail: null,
    href: '/modules',
    cta: 'Explorer les cours',
  };
}

export function homeSuggestion(input: HomeInput): Suggestion | null {
  if (input.dueReviews > 0)
    return {
      title:
        input.dueReviews === 1
          ? '1 notion à revoir aujourd’hui'
          : `${input.dueReviews} notions à revoir aujourd’hui`,
      href: '/defis/revisions',
    };
  if (input.hasPractice) return { title: 'Un défi de 2 minutes ?', href: '/defis/express' };
  return null;
}
