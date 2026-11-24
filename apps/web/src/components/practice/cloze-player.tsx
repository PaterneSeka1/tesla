'use client';

import {
  clozeBlanks,
  CLOZE_BLANK,
  type PracticeActivity,
  sameWord,
  stableShuffle,
} from '@tesla/shared';
import { Eye } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { feedback } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { type PlayerProps } from './kit';

type Cloze = Extract<PracticeActivity, { kind: 'cloze' }>;

/** Découpe le texte en segments fixes et trous (le texte d'origine n'est jamais modifié). */
function segments(text: string): (string | { blank: number })[] {
  const parts: (string | { blank: number })[] = [];
  let last = 0;
  let blank = 0;
  for (const match of text.matchAll(CLOZE_BLANK)) {
    parts.push(text.slice(last, match.index));
    parts.push({ blank: blank++ });
    last = match.index! + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/**
 * Texte à compléter : propositions affichées par défaut (aide), saisie libre possible. Pour un
 * texte de référence (prière, loi), aucun score : on compare simplement avec le texte original.
 */
export function ClozePlayer({ activity, reverent, onDone }: PlayerProps<Cloze>) {
  const blanks = useMemo(() => clozeBlanks(activity.text), [activity.text]);
  const parts = useMemo(() => segments(activity.text), [activity.text]);
  const bank = useMemo(() => stableShuffle(blanks, activity.id), [blanks, activity.id]);
  const [values, setValues] = useState<string[]>(() => blanks.map(() => ''));
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState(false);
  const [withBank, setWithBank] = useState(true);
  const [original, setOriginal] = useState(false);
  const results = blanks.map((word, index) => sameWord(values[index] ?? '', word));
  const used = new Set(values.map((value) => value.toLocaleLowerCase('fr')));

  const fill = (word: string) => {
    const next = [...values];
    next[active] = word;
    setValues(next);
    const following = next.findIndex((value, index) => index > active && value === '');
    setActive(following === -1 ? next.findIndex((value) => value === '') : following);
  };

  const check = () => {
    setChecked(true);
    feedback(results.every(Boolean) ? 'success' : 'error');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 text-[1.05rem] leading-9 whitespace-pre-line sm:p-5">
        {parts.map((part, index) =>
          typeof part === 'string' ? (
            <Fragment key={index}>{part}</Fragment>
          ) : original ? (
            <mark key={index} className="rounded bg-tesla-sable px-1 font-medium">
              {blanks[part.blank]}
            </mark>
          ) : (
            <input
              key={index}
              value={values[part.blank]}
              onFocus={() => setActive(part.blank)}
              onChange={(event) => {
                const next = [...values];
                next[part.blank] = event.target.value;
                setValues(next);
                setChecked(false);
              }}
              aria-label={`Mot manquant ${part.blank + 1}`}
              aria-invalid={checked && !results[part.blank] ? true : undefined}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              size={Math.max(4, blanks[part.blank]!.length)}
              className={cn(
                'mx-0.5 inline-block h-8 rounded-md border-b-2 bg-muted/60 px-1.5 text-center align-baseline outline-none focus:border-tesla-rouge focus:bg-tesla-sable/40',
                active === part.blank && 'border-tesla-rouge',
                checked &&
                  (results[part.blank]
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-destructive bg-red-50'),
              )}
            />
          ),
        )}
      </div>

      {withBank && !original && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Propositions">
          {bank.map((word, index) => (
            <Button
              key={`${word}-${index}`}
              variant="outline"
              size="sm"
              className={cn('rounded-full', used.has(word.toLocaleLowerCase('fr')) && 'opacity-40')}
              onClick={() => fill(word)}
            >
              {word}
            </Button>
          ))}
        </div>
      )}

      {checked && (
        <p role="status" className="text-sm font-medium">
          {results.every(Boolean)
            ? 'Texte complet.'
            : reverent
              ? 'Comparez avec le texte original.'
              : `${results.filter(Boolean).length} mot(s) sur ${blanks.length}.`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {checked && (results.every(Boolean) || original) ? (
          <Button onClick={() => onDone(values)} autoFocus>
            Terminer
          </Button>
        ) : (
          <Button onClick={check} disabled={values.every((value) => value.trim() === '')}>
            Vérifier
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOriginal(!original)}
          aria-pressed={original}
        >
          <Eye aria-hidden />
          {original ? 'Masquer le texte' : 'Texte original'}
        </Button>
        {!original && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWithBank(!withBank)}
            aria-pressed={!withBank}
          >
            {withBank ? 'Sans propositions' : 'Avec propositions'}
          </Button>
        )}
      </div>
    </div>
  );
}
