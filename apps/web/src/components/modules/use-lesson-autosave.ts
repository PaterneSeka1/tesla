'use client';

import { lessonDocumentSchema, type ModuleLesson } from '@tesla/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { updateLesson } from '@/lib/api/modules';
import {
  clearLessonDraft,
  type LessonDraft,
  readLessonDraft,
  sameLessonContent,
  writeLessonDraft,
} from '@/lib/lesson-drafts';

/**
 * États de l'enregistrement automatique d'une leçon :
 * - `saved` : la version affichée est celle du serveur ;
 * - `dirty` : modification en attente d'envoi (court délai d'inactivité) ;
 * - `saving` : envoi en cours (un seul à la fois) ;
 * - `offline` : pas de réseau, saisie conservée sur l'appareil, envoi au retour du réseau ;
 * - `error` / `invalid` : envoi refusé (message), saisie conservée ;
 * - `conflict` : la leçon a changé sur le serveur ; rien n'est remplacé sans décision explicite.
 */
export type AutosaveStatus =
  'saved' | 'dirty' | 'saving' | 'offline' | 'error' | 'invalid' | 'conflict';

export interface LessonValues {
  title: string;
  duration: string;
  content: unknown;
}

/** Délai d'inactivité avant l'envoi (ms) : jamais une requête par frappe. */
export const AUTOSAVE_DELAY_MS = 1500;
const RETRY_MS = 20_000;

const serverValues = (lesson: ModuleLesson): LessonValues => ({
  title: lesson.title,
  duration: lesson.durationMinutes ? String(lesson.durationMinutes) : '',
  content: lesson.content,
});

function initialState(lesson: ModuleLesson) {
  const server = serverValues(lesson);
  const draft = readLessonDraft(lesson.id);
  if (!draft || sameLessonContent(draft, server)) {
    if (draft) clearLessonDraft(lesson.id);
    return {
      values: server,
      base: lesson.revision,
      status: 'saved' as AutosaveStatus,
      restored: false,
    };
  }
  const values = { title: draft.title, duration: draft.duration, content: draft.content };
  // Brouillon non envoyé sur la version actuelle : reprise et envoi ; sinon la leçon a changé
  // entre-temps sur le serveur : décision demandée.
  return draft.baseRevision === lesson.revision
    ? { values, base: draft.baseRevision, status: 'dirty' as AutosaveStatus, restored: true }
    : { values, base: draft.baseRevision, status: 'conflict' as AutosaveStatus, restored: true };
}

function validate(values: LessonValues) {
  if (!values.title.trim()) return { error: 'Le titre de la leçon est requis.' } as const;
  const minutes = values.duration.trim() === '' ? null : Number(values.duration);
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 6000)) {
    return { error: 'Durée : nombre entier de minutes entre 1 et 6 000.' } as const;
  }
  const parsed = lessonDocumentSchema.safeParse(values.content);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Contenu invalide.' } as const;
  }
  return { input: { title: values.title.trim(), durationMinutes: minutes, content: parsed.data } };
}

const isNetworkError = (error: unknown) =>
  (error instanceof ApiError && (error.status === 0 || error.code === 'NETWORK_ERROR')) ||
  (typeof navigator !== 'undefined' && navigator.onLine === false);

/**
 * Enregistrement automatique d'une leçon (composant monté par leçon, clé = identifiant).
 * Révision optimiste conservée : chaque envoi porte la révision de référence ; un `EDIT_CONFLICT`
 * suspend l'envoi sans jamais écraser la version distante.
 */
export function useLessonAutosave(
  lesson: ModuleLesson,
  {
    editable,
    onSaved,
    onConflict,
  }: { editable: boolean; onSaved: () => void; onConflict: () => void },
) {
  const [initial] = useState(() => initialState(lesson));
  const [values, setValues] = useState<LessonValues>(initial.values);
  const [status, setStatus] = useState<AutosaveStatus>(initial.status);
  const [message, setMessage] = useState<string | null>(null);
  const [restored, setRestored] = useState(initial.restored);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const valuesRef = useRef(values);
  const baseRef = useRef(initial.base);
  const statusRef = useRef(status);
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onSaved, onConflict });
  useEffect(() => {
    callbacks.current = { onSaved, onConflict };
  }, [onSaved, onConflict]);

  const updateStatus = (next: AutosaveStatus) => {
    statusRef.current = next;
    setStatus(next);
  };
  const storeDraft = () =>
    writeLessonDraft({
      lessonId: lesson.id,
      baseRevision: baseRef.current,
      ...valuesRef.current,
      savedAt: Date.now(),
    } satisfies LessonDraft);

  const save = useCallback(async (): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (!editable || statusRef.current === 'conflict' || statusRef.current === 'saved') return;
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    const checked = validate(valuesRef.current);
    if ('error' in checked) {
      setMessage(checked.error ?? null);
      updateStatus('invalid');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      updateStatus('offline');
      return;
    }
    savingRef.current = true;
    const version = versionRef.current;
    const startedAt = Date.now();
    updateStatus('saving');
    try {
      await updateLesson(lesson.id, { revision: baseRef.current, ...checked.input });
      baseRef.current += 1;
      setMessage(null);
      setSavedAt(Date.now());
      if (versionRef.current === version) {
        clearLessonDraft(lesson.id, startedAt);
        clearLessonDraft(lesson.id);
        updateStatus('saved');
      } else {
        // Saisie pendant l'envoi : le brouillon repose désormais sur la nouvelle révision.
        storeDraft();
        updateStatus('dirty');
        pendingRef.current = true;
      }
      callbacks.current.onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EDIT_CONFLICT') {
        updateStatus('conflict');
        callbacks.current.onConflict();
      } else if (isNetworkError(error)) {
        updateStatus('offline');
      } else {
        setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.');
        updateStatus('error');
      }
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void save();
      }
    }
    // `lesson.id` est stable : le composant est monté par leçon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, lesson.id]);

  const change = (patch: Partial<LessonValues>) => {
    const next = { ...valuesRef.current, ...patch };
    valuesRef.current = next;
    versionRef.current += 1;
    setValues(next);
    setRestored(false);
    if (!storeDraft())
      setMessage('Stockage de l’appareil indisponible : gardez cette page ouverte.');
    if (statusRef.current !== 'conflict') updateStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  };

  // Reprise d'un brouillon non envoyé : envoi immédiat.
  useEffect(() => {
    if (initial.status === 'dirty') void save();
  }, [initial.status, save]);

  // Leçon modifiée ailleurs sans saisie locale : affichage de la version du serveur.
  useEffect(() => {
    if (statusRef.current !== 'saved' || savingRef.current) return;
    if (lesson.revision > baseRef.current) {
      baseRef.current = lesson.revision;
      valuesRef.current = serverValues(lesson);
      setValues(valuesRef.current);
      setEditorKey((k) => k + 1);
    }
  }, [lesson]);

  // Retour du réseau et nouvelles tentatives périodiques.
  useEffect(() => {
    if (status !== 'offline' && status !== 'error') return;
    const retry = () => void save();
    window.addEventListener('online', retry);
    const interval = setInterval(retry, RETRY_MS);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(interval);
    };
  }, [status, save]);

  // Changement de leçon ou de page : envoi immédiat de la saisie (le brouillon local reste le filet).
  useEffect(
    () => () => {
      if (statusRef.current === 'dirty') void save();
    },
    [save],
  );

  /** Garder ma version : décision explicite, la version distante est remplacée par ma saisie. */
  const keepMine = () => {
    baseRef.current = lesson.revision;
    storeDraft();
    updateStatus('dirty');
    void save();
  };
  /** Reprendre la version enregistrée : ma saisie locale est abandonnée. */
  const takeServer = () => {
    baseRef.current = lesson.revision;
    valuesRef.current = serverValues(lesson);
    setValues(valuesRef.current);
    clearLessonDraft(lesson.id);
    setRestored(false);
    setMessage(null);
    setEditorKey((k) => k + 1);
    updateStatus('saved');
  };

  return {
    values,
    status,
    message,
    restored,
    savedAt,
    editorKey,
    change,
    saveNow: () => void save(),
    keepMine,
    takeServer,
  };
}
