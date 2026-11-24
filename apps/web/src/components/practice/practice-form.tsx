'use client';

import {
  clozeBlanks,
  type PracticeActivity,
  practiceActivitySchema,
  PRACTICE_KIND_LABELS,
} from '@tesla/shared';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ActivityRunner } from './activity-runner';

/** Consigne d'une ligne par type : ce que voit le routier (aucun paramètre technique). */
const HINTS: Record<PracticeActivity['kind'], string> = {
  quiz: 'Une question, plusieurs propositions, une seule bonne réponse.',
  truefalse: 'Une affirmation à juger vraie ou fausse.',
  match: 'Des paires à relier (notion et définition, date et événement…).',
  order: 'Des étapes à remettre dans l’ordre ; saisissez-les dans le bon ordre.',
  flashcards: 'Une question au recto, la réponse au verso.',
  cloze: 'Un texte dont les mots à retrouver sont entre doubles crochets : Toujours [[prêt]].',
  scenario: 'Une situation et des choix possibles, chacun avec son éclairage (pas de note).',
};

const textarea =
  'min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * Rédaction d'une activité (D194) : champs simples, ajout et retrait de lignes, aperçu immédiat
 * dans le rendu apprenant (sans rien enregistrer). La validation est celle de l'API
 * (`practiceActivitySchema`) : le premier problème est affiché en clair.
 */
export function PracticeFormDialog({
  initial,
  open,
  onOpenChange,
  onSave,
}: {
  initial: PracticeActivity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (activity: PracticeActivity) => void;
}) {
  const [draft, setDraft] = useState<PracticeActivity>(initial);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const titleId = useId();

  const update = (next: PracticeActivity) => {
    setDraft(next);
    setError(null);
  };
  const save = () => {
    const parsed = practiceActivitySchema.safeParse(draft);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        `${issue?.message ?? 'Activité incomplète.'}${issue?.path.length ? ` (${describePath(issue.path)})` : ''}`,
      );
      setPreview(false);
      return;
    }
    onSave(parsed.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={titleId}>
        <DialogHeader>
          <DialogTitle>{PRACTICE_KIND_LABELS[draft.kind]}</DialogTitle>
          <DialogDescription id={titleId}>{HINTS[draft.kind]}</DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="rounded-xl border bg-background p-4">
            <ActivityRunner item={{ moduleSlug: '', key: draft.id, activity: draft }} compact />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Titre (facultatif)">
              {(id) => (
                <Input
                  id={id}
                  value={draft.title ?? ''}
                  maxLength={120}
                  onChange={(event) => update({ ...draft, title: event.target.value })}
                />
              )}
            </Field>
            <KindFields draft={draft} update={update} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!preview && !practiceActivitySchema.safeParse(draft).success) return save();
              setPreview(!preview);
            }}
          >
            {preview ? <Pencil aria-hidden /> : <Eye aria-hidden />}
            {preview ? 'Modifier' : 'Aperçu'}
          </Button>
          <Button type="button" onClick={save}>
            Enregistrer l’activité
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function describePath(path: PropertyKey[]): string {
  const labels: Record<string, string> = {
    items: 'élément',
    pairs: 'paire',
    steps: 'étape',
    cards: 'carte',
    choices: 'choix',
    options: 'proposition',
  };
  return path
    .map((part, index) =>
      typeof part === 'number' && typeof path[index - 1] === 'string'
        ? `${labels[path[index - 1] as string] ?? ''} ${part + 1}`.trim()
        : null,
    )
    .filter(Boolean)
    .join(', ');
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
    </div>
  );
}

/** Liste de lignes avec ajout et retrait (au moins `min`, au plus `max`). */
function Rows<T>({
  rows,
  min,
  max,
  add,
  onChange,
  addLabel,
  render,
}: {
  rows: T[];
  min: number;
  max: number;
  add: () => NoInfer<T>;
  onChange: (rows: T[]) => void;
  addLabel: string;
  render: (row: T, set: (row: T) => void, index: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-0 flex-1 space-y-2">
            {render(
              row,
              (next) => onChange(rows.map((current, i) => (i === index ? next : current))),
              index,
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={rows.length <= min}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            aria-label={`Retirer la ligne ${index + 1}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      {rows.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, add()])}
        >
          <Plus aria-hidden />
          {addLabel}
        </Button>
      )}
    </div>
  );
}

function KindFields({
  draft,
  update,
}: {
  draft: PracticeActivity;
  update: (next: PracticeActivity) => void;
}) {
  switch (draft.kind) {
    case 'quiz':
      return (
        <Rows
          rows={draft.items}
          min={1}
          max={30}
          addLabel="Ajouter une question"
          add={() => ({ prompt: '', options: ['', ''], answer: 0 })}
          onChange={(items) => update({ ...draft, items })}
          render={(item, set, index) => (
            <>
              <Field label={`Question ${index + 1}`}>
                {(id) => (
                  <Input
                    id={id}
                    value={item.prompt}
                    onChange={(e) => set({ ...item, prompt: e.target.value })}
                  />
                )}
              </Field>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Propositions (cochez la bonne)</legend>
                {item.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`answer-${draft.id}-${index}`}
                      checked={item.answer === optionIndex}
                      onChange={() => set({ ...item, answer: optionIndex })}
                      aria-label={`Bonne réponse : proposition ${optionIndex + 1}`}
                      className="size-4 accent-tesla-rouge"
                    />
                    <Input
                      value={option}
                      aria-label={`Proposition ${optionIndex + 1}`}
                      onChange={(e) =>
                        set({
                          ...item,
                          options: item.options.map((o, i) =>
                            i === optionIndex ? e.target.value : o,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={item.options.length <= 2}
                      aria-label={`Retirer la proposition ${optionIndex + 1}`}
                      onClick={() =>
                        set({
                          ...item,
                          options: item.options.filter((_, i) => i !== optionIndex),
                          answer:
                            item.answer === optionIndex
                              ? 0
                              : item.answer > optionIndex
                                ? item.answer - 1
                                : item.answer,
                        })
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ))}
                {item.options.length < 6 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set({ ...item, options: [...item.options, ''] })}
                  >
                    <Plus aria-hidden />
                    Proposition
                  </Button>
                )}
              </fieldset>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Indice et explication
                </summary>
                <div className="mt-2 space-y-2">
                  <Field label="Indice (entraînement)">
                    {(id) => (
                      <Input
                        id={id}
                        value={item.hint ?? ''}
                        onChange={(e) => set({ ...item, hint: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Explication après la réponse">
                    {(id) => (
                      <textarea
                        id={id}
                        className={textarea}
                        value={item.explanation ?? ''}
                        onChange={(e) => set({ ...item, explanation: e.target.value })}
                      />
                    )}
                  </Field>
                </div>
              </details>
            </>
          )}
        />
      );
    case 'truefalse':
      return (
        <Rows
          rows={draft.items}
          min={1}
          max={30}
          addLabel="Ajouter une affirmation"
          add={() => ({ statement: '', answer: true })}
          onChange={(items) => update({ ...draft, items })}
          render={(item, set, index) => (
            <>
              <Field label={`Affirmation ${index + 1}`}>
                {(id) => (
                  <Input
                    id={id}
                    value={item.statement}
                    onChange={(e) => set({ ...item, statement: e.target.value })}
                  />
                )}
              </Field>
              <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Réponse">
                {[true, false].map((value) => (
                  <label key={String(value)} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={item.answer === value}
                      onChange={() => set({ ...item, answer: value })}
                      className="size-4 accent-tesla-rouge"
                    />
                    {value ? 'Vrai' : 'Faux'}
                  </label>
                ))}
              </div>
              <Field label="Explication (facultative)">
                {(id) => (
                  <Input
                    id={id}
                    value={item.explanation ?? ''}
                    onChange={(e) => set({ ...item, explanation: e.target.value })}
                  />
                )}
              </Field>
            </>
          )}
        />
      );
    case 'match':
      return (
        <Rows
          rows={draft.pairs}
          min={2}
          max={10}
          addLabel="Ajouter une paire"
          add={() => ({ left: '', right: '' })}
          onChange={(pairs) => update({ ...draft, pairs })}
          render={(pair, set, index) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label={`Élément ${index + 1}`}
                placeholder="Élément"
                value={pair.left}
                onChange={(e) => set({ ...pair, left: e.target.value })}
              />
              <Input
                aria-label={`Correspondance ${index + 1}`}
                placeholder="Correspondance"
                value={pair.right}
                onChange={(e) => set({ ...pair, right: e.target.value })}
              />
            </div>
          )}
        />
      );
    case 'order':
      return (
        <Rows
          rows={draft.steps}
          min={3}
          max={10}
          addLabel="Ajouter une étape"
          add={() => ({ label: '' })}
          onChange={(steps) => update({ ...draft, steps })}
          render={(step, set, index) => (
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <Input
                aria-label={`Étape ${index + 1}`}
                placeholder={`Étape ${index + 1}`}
                value={step.label}
                onChange={(e) => set({ ...step, label: e.target.value })}
              />
              <Input
                aria-label={`Repère de l’étape ${index + 1} (date…)`}
                placeholder="Date (facultatif)"
                value={step.marker ?? ''}
                onChange={(e) => set({ ...step, marker: e.target.value })}
              />
            </div>
          )}
        />
      );
    case 'flashcards':
      return (
        <Rows
          rows={draft.cards}
          min={1}
          max={40}
          addLabel="Ajouter une carte"
          add={() => ({ front: '', back: '' })}
          onChange={(cards) => update({ ...draft, cards })}
          render={(card, set, index) => (
            <>
              <Input
                aria-label={`Recto ${index + 1}`}
                placeholder="Recto : la question"
                value={card.front}
                onChange={(e) => set({ ...card, front: e.target.value })}
              />
              <textarea
                aria-label={`Verso ${index + 1}`}
                placeholder="Verso : la réponse"
                className={textarea}
                value={card.back}
                onChange={(e) => set({ ...card, back: e.target.value })}
              />
            </>
          )}
        />
      );
    case 'cloze':
      return (
        <Field label="Texte">
          {(id) => (
            <>
              <textarea
                id={id}
                className={cn(textarea, 'min-h-40')}
                value={draft.text}
                onChange={(e) => update({ ...draft, text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {clozeBlanks(draft.text).length} mot(s) à retrouver.
              </p>
            </>
          )}
        </Field>
      );
    case 'scenario':
      return (
        <div className="space-y-4">
          <Field label="Situation">
            {(id) => (
              <textarea
                id={id}
                className={textarea}
                value={draft.situation}
                onChange={(e) => update({ ...draft, situation: e.target.value })}
              />
            )}
          </Field>
          <Rows
            rows={draft.choices}
            min={2}
            max={5}
            addLabel="Ajouter un choix"
            add={() => ({ label: '', insight: '' })}
            onChange={(choices) => update({ ...draft, choices })}
            render={(choice, set, index) => (
              <>
                <Input
                  aria-label={`Choix ${index + 1}`}
                  placeholder={`Choix ${index + 1}`}
                  value={choice.label}
                  onChange={(e) => set({ ...choice, label: e.target.value })}
                />
                <textarea
                  aria-label={`Éclairage du choix ${index + 1}`}
                  placeholder="Éclairage : conséquences, points d’attention"
                  className={textarea}
                  value={choice.insight}
                  onChange={(e) => set({ ...choice, insight: e.target.value })}
                />
              </>
            )}
          />
        </div>
      );
  }
}
