import { describe, expect, it } from 'vitest';
import {
  installGuideFor,
  isAppleMobile,
  isInAppBrowser,
  isInstallPromptExcluded,
} from './pwa-install';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1',
  ipadOs:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0]',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36 Instagram 390.0',
};

const guide = (userAgent: string, extra: Partial<Parameters<typeof installGuideFor>[0]> = {}) =>
  installGuideFor({
    userAgent,
    maxTouchPoints: 5,
    standalone: false,
    hasNativePrompt: false,
    ...extra,
  });

describe('Invitation à installer l’application (D184)', () => {
  it('iPhone et iPad (y compris iPadOS présenté comme un Mac tactile) : geste expliqué', () => {
    expect(guide(UA.iphoneSafari)).toBe('IOS');
    expect(guide(UA.iphoneChrome)).toBe('IOS');
    expect(guide(UA.ipadOs)).toBe('IOS');
    expect(isAppleMobile(UA.ipadOs, 0)).toBe(false);
  });

  it('Android ou ordinateur : bouton seulement si le navigateur propose l’installation', () => {
    expect(guide(UA.android, { hasNativePrompt: true })).toBe('NATIVE');
    // Sans événement natif : déjà installée ou navigateur incompatible, aucune invitation.
    expect(guide(UA.android)).toBeNull();
  });

  it('navigateur intégré à une autre application : ouvrir dans le navigateur', () => {
    expect(isInAppBrowser(UA.facebookIos)).toBe(true);
    expect(guide(UA.facebookIos)).toBe('IN_APP');
    expect(guide(UA.instagramAndroid, { hasNativePrompt: true })).toBe('IN_APP');
    expect(isInAppBrowser(UA.iphoneSafari)).toBe(false);
  });

  it('application déjà ouverte depuis l’écran d’accueil : jamais d’invitation', () => {
    expect(guide(UA.iphoneSafari, { standalone: true })).toBeNull();
    expect(guide(UA.android, { standalone: true, hasNativePrompt: true })).toBeNull();
  });

  it('liens à jeton et page hors ligne exclus', () => {
    expect(isInstallPromptExcluded('/activation')).toBe(true);
    expect(isInstallPromptExcluded('/reinitialiser-mot-de-passe')).toBe(true);
    expect(isInstallPromptExcluded('/inscription')).toBe(true);
    expect(isInstallPromptExcluded('/hors-ligne')).toBe(true);
    expect(isInstallPromptExcluded('/connexion')).toBe(false);
    expect(isInstallPromptExcluded('/accueil')).toBe(false);
  });
});
