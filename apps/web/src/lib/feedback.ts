'use client';

import { readPreferences } from './preferences';

/**
 * Retour sensoriel centralisé (D195). Un seul canal non visuel par événement : vibration brève sur
 * appareil compatible, son synthétisé seulement si l'utilisateur l'a activé. Le retour visuel
 * (couleur, texte, icône) reste toujours présent : rien ne dépend uniquement du son ou de la
 * vibration. Aucun fichier audio n'est téléchargé.
 */
export type FeedbackKind = 'success' | 'error' | 'reward';

const VIBRATIONS: Record<FeedbackKind, number | number[]> = {
  success: 12,
  error: [18, 40, 18],
  reward: [10, 30, 10, 30, 24],
};

const TONES: Record<FeedbackKind, number[]> = {
  success: [660, 880],
  error: [220],
  reward: [523, 659, 784],
};

let audio: AudioContext | null = null;

function play(frequencies: number[]) {
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return;
  audio ??= new Context();
  const start = audio.currentTime;
  frequencies.forEach((frequency, index) => {
    const oscillator = audio!.createOscillator();
    const gain = audio!.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const at = start + index * 0.09;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    oscillator.connect(gain).connect(audio!.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.18);
  });
}

export function feedback(kind: FeedbackKind) {
  if (typeof window === 'undefined') return;
  const preferences = readPreferences();
  try {
    if (preferences.sound) play(TONES[kind]);
    else if (preferences.haptics) navigator.vibrate?.(VIBRATIONS[kind]);
  } catch {
    // Retour facultatif : jamais bloquant.
  }
}
