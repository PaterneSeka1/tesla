/** Présentation de première visite (D199) : vue une fois par appareil, revue depuis « Mon profil ». */
const KEY = 'tesla.onboarding.done';

export function onboardingDone(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Stockage indisponible : la présentation pourra réapparaître.
  }
}

export function resetOnboarding() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible.
  }
}
