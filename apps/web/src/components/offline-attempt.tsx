'use client';
import { useEffect, useRef, useState } from 'react';
import { AnswerFields } from '@/components/evaluations/answer-fields';
import { Button } from '@/components/ui/button';
import { type LocalAttempt, saveLocalAnswers, submitLocal } from '@/lib/offline/attempts';
import { readRecord } from '@/lib/offline/vault';

export function OfflineAttempt({ id }: { id: string }) {
  const [item, setItem] = useState<LocalAttempt | null>(null);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('Chargement…');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const edits = useRef(Promise.resolve());
  useEffect(() => {
    let disposed = false;
    const load = async (initial = false) => {
      try {
        const row = await readRecord<LocalAttempt>(`attempt:${id}`);
        if (disposed) return;
        if (!row) {
          setMessage('Tentative non préparée sur cet appareil. Préparez-la en ligne.');
          return;
        }
        if (initial || row.value.status !== 'LOCAL') {
          revision.current = row.revision;
          setItem(row.value);
          setMessage(
            row.value.status === 'LOCAL'
              ? 'Réponses enregistrées sur cet appareil.'
              : (row.value.server?.message ??
                  'Copie remise localement ; en attente de confirmation serveur.'),
          );
        }
      } catch (e) {
        if (!disposed) setMessage(e instanceof Error ? e.message : 'Lecture impossible.');
      }
    };
    const changed = () => {
      void load();
    };
    void load(true);
    window.addEventListener('offline-data-change', changed);
    return () => {
      disposed = true;
      window.removeEventListener('offline-data-change', changed);
    };
  }, [id]);
  const save = (answers: LocalAttempt['answers']) => {
    setItem((previous) => (previous ? { ...previous, answers } : previous));
    setMessage('Enregistrement local…');
    edits.current = edits.current.then(async () => {
      await saveLocalAnswers(id, answers, revision.current);
      revision.current++;
      setMessage('Réponses enregistrées sur cet appareil.');
    });
    void edits.current.catch((error) =>
      setMessage(`Échec : ${error.message}. Rechargez la copie avant de continuer.`),
    );
  };
  async function submit() {
    if (
      !window.confirm(
        'Remettre définitivement cette copie ? Elle sera immuable et attendra la confirmation du serveur.',
      )
    )
      return;
    setBusy(true);
    try {
      await edits.current;
      await submitLocal(id);
      const row = await readRecord<LocalAttempt>(`attempt:${id}`);
      setItem(row?.value ?? null);
      setMessage('En attente de synchronisation. Aucun résultat officiel n’est encore enregistré.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Remise impossible.');
    } finally {
      setBusy(false);
    }
  }
  if (!item) return <p role="status">{message}</p>;
  const question = item.package.session.questions[index];
  if (!question) return <p>Questionnaire vide ou incompatible.</p>;
  const answer = item.answers.find((a) => a.questionId === question.id);
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">{item.package.session.evaluation.title}</h2>
      <p>
        {item.package.session.code} · version {item.package.session.version} · {item.status}
      </p>
      <p className="text-sm">
        Réception serveur exigée avant le {new Date(item.package.expiresAt).toLocaleString('fr-FR')}
        . L’heure de l’appareil ne prouve pas l’heure réelle de réalisation.
      </p>
      <p className="whitespace-pre-line">{item.package.session.evaluation.instructions}</p>
      <p>
        Question {index + 1}/{item.package.session.questions.length}
      </p>
      <AnswerFields
        question={question}
        answer={{ optionIds: answer?.optionIds ?? [], text: answer?.text ?? '' }}
        disabled={item.status !== 'LOCAL' || busy}
        onChange={(value) =>
          save(
            item.answers.map((a) =>
              a.questionId === question.id ? { questionId: question.id, ...value } : a,
            ),
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Précédente
        </Button>
        <Button
          variant="outline"
          disabled={index >= item.package.session.questions.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          Suivante
        </Button>
        {item.status === 'LOCAL' && (
          <Button disabled={busy} onClick={() => void submit()}>
            Remettre localement
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {item.server && (
        <p>
          {item.server.code} — {item.server.message}
        </p>
      )}
      {item.lastError && <p role="alert">{item.lastError}</p>}
      <p className="text-sm text-muted-foreground">
        Un résultat ne valide jamais automatiquement une étape ou une compétence.
      </p>
    </section>
  );
}
