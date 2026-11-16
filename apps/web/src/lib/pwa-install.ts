/**
 * Invitation à installer l'application (PWA), D184.
 *
 * - Chrome, Edge, Samsung Internet (Android, ordinateur) : l'événement `beforeinstallprompt` permet
 *   une installation en un geste. Il n'est émis que si l'application n'est pas déjà installée.
 * - iPhone et iPad : aucune API d'installation ; seule l'explication du geste « Partager → Sur
 *   l'écran d'accueil » est possible, et Safari ne sait pas si l'application est déjà installée.
 * - Navigateurs intégrés (Facebook, Instagram…) : installation impossible, il faut ouvrir le lien
 *   dans le navigateur.
 */

/** Événement non standard de Chromium (absent des types DOM). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    /** Invitation native captée avant le démarrage de React (voir `INSTALL_CAPTURE_SCRIPT`). */
    __teslaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
  interface Navigator {
    /** Safari iOS : vrai lorsque la page est ouverte depuis l'écran d'accueil. */
    standalone?: boolean;
  }
}

/** Émis sur `window` quand l'invitation native devient disponible. */
export const INSTALLABLE_EVENT = 'tesla:installable';
/** Émis quand l'invitation native a été consommée (elle ne sert qu'une fois). */
export const INSTALL_CHANGED_EVENT = 'tesla:install-changed';
/** Demande explicite d'ouverture de l'invitation (entrée « Installer l'application » du menu). */
export const OPEN_INSTALL_EVENT = 'tesla:open-install';

/**
 * Script en ligne exécuté avant React : `beforeinstallprompt` peut survenir avant l'hydratation et
 * serait sinon perdu. L'invitation par défaut du navigateur est remplacée par la modale.
 */
export const INSTALL_CAPTURE_SCRIPT = `(function(){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__teslaInstallPrompt=e;window.dispatchEvent(new Event('${INSTALLABLE_EVENT}'));});window.addEventListener('appinstalled',function(){window.__teslaInstallPrompt=null;});})();`;

export type InstallGuide = 'NATIVE' | 'IOS' | 'IN_APP' | null;

/** iPhone, iPod, iPad (iPadOS se présente comme un Mac tactile). */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

/** Navigateur intégré à une application tierce, qui ne permet pas l'installation. */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Snapchat|TikTok|musical_ly|LinkedInApp|Twitter|Line\//i.test(
    userAgent,
  );
}

/**
 * Explication à proposer, ou `null` : application déjà ouverte en mode installé, ou navigateur sans
 * installation possible (ou déjà installée : Chromium n'émet alors pas `beforeinstallprompt`).
 */
/** Vrai dans l'application installée (écran d'accueil), faux dans un onglet du navigateur. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

/** Explication possible dans ce navigateur, maintenant (voir `installGuideFor`). */
export function currentInstallGuide(): InstallGuide {
  return installGuideFor({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
    hasNativePrompt: Boolean(window.__teslaInstallPrompt),
  });
}

export function installGuideFor(input: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasNativePrompt: boolean;
}): InstallGuide {
  if (input.standalone) return null;
  if (isInAppBrowser(input.userAgent)) return 'IN_APP';
  if (input.hasNativePrompt) return 'NATIVE';
  if (isAppleMobile(input.userAgent, input.maxTouchPoints)) return 'IOS';
  return null;
}

/**
 * Pages où l'invitation n'apparaît jamais : liens à jeton (installer ouvrirait l'application sur
 * l'accueil et perdrait le jeton) et page de secours hors ligne. Les passations d'évaluation sont
 * exclues par `isImmersivePath`.
 */
const EXCLUDED = /^\/(activation|inscription|reinitialiser-mot-de-passe|hors-ligne)(\/|$)/;

export function isInstallPromptExcluded(pathname: string): boolean {
  return EXCLUDED.test(pathname);
}

/** « Plus tard » : plus d'invitation jusqu'à la fermeture de l'onglet (prochain lien ouvert). */
export const INSTALL_DISMISSED_KEY = 'tesla.install.dismissed';
/** iPhone/iPad : « Elle est déjà installée », mémorisé pour ce navigateur. */
export const INSTALL_DECLARED_KEY = 'tesla.install.declared';

export function readFlag(storage: () => Storage, key: string): boolean {
  try {
    return storage().getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(storage: () => Storage, key: string): void {
  try {
    storage().setItem(key, '1');
  } catch {
    // Stockage indisponible (navigation privée) : l'invitation pourra réapparaître.
  }
}
