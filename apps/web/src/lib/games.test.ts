import { type PracticeActivity } from '@tesla/shared';
import { describe, expect, it } from 'vitest';
import {
  allAscensionQuestions,
  ascensionQuestions,
  type BankEntry,
  dueInBank,
  entryId,
  gameMode,
  isPlayable,
  pickSession,
  playableModes,
} from './games';

const quiz = (id: string, count: number, difficulty?: number): PracticeActivity => ({
  kind: 'quiz',
  id,
  ...(difficulty && { difficulty }),
  items: Array.from({ length: count }, (_, index) => ({
    prompt: `Question ${id} ${index} ?`,
    options: ['A', 'B', 'C'],
    answer: index % 3,
  })),
});

const entry = (key: string, activity: PracticeActivity, lessonId = `lecon-${key}`): BankEntry => ({
  origin: 'authored',
  moduleSlug: 'module-fictif',
  moduleTitle: 'Module fictif',
  key,
  fingerprint: `f-${key}`,
  lessonId,
  lessonTitle: `Leçon ${key}`,
  activity,
});

const order = (id: string): PracticeActivity => ({
  kind: 'order',
  id,
  steps: [{ label: 'Un' }, { label: 'Deux' }, { label: 'Trois' }],
});

describe('disponibilité des jeux (D201)', () => {
  it('L’Ascension exige au moins quatre questions à choix', () => {
    const ascension = gameMode('ascension')!;
    expect(isPlayable(ascension, [entry('q1', quiz('q1', 3))])).toBe(false);
    expect(isPlayable(ascension, [entry('q1', quiz('q1', 3)), entry('q2', quiz('q2', 1))])).toBe(
      true,
    );
  });

  it('le défi express n’est pas proposé sans activité compatible', () => {
    const entries = [entry('o1', order('o1'))];
    expect(isPlayable(gameMode('express')!, entries)).toBe(false);
    const keys = playableModes(entries).map((mode) => mode.key);
    expect(keys).toEqual(['frises']);
  });

  it('révisions : seules les activités encore publiées comptent', () => {
    const entries = [entry('q1', quiz('q1', 2))];
    const due = [
      {
        moduleSlug: 'module-fictif',
        activityKey: 'q1',
        activityKind: 'quiz' as const,
        dueOn: '2026-11-20',
        box: 1,
      },
      {
        moduleSlug: 'module-fictif',
        activityKey: 'retiree',
        activityKind: 'quiz' as const,
        dueOn: '2026-11-20',
        box: 1,
      },
    ];
    expect(dueInBank(entries, due).map((row) => row.activityKey)).toEqual(['q1']);
    expect(isPlayable(gameMode('revisions')!, entries, due)).toBe(true);
    expect(isPlayable(gameMode('revisions')!, entries, due.slice(1))).toBe(false);
  });
});

describe('sélection des exercices (D201)', () => {
  const entries = [
    entry('a1', quiz('a1', 1), 'l1'),
    entry('a2', quiz('a2', 1), 'l1'),
    entry('b1', quiz('b1', 1), 'l2'),
    entry('c1', quiz('c1', 1), 'l3'),
    entry('d1', quiz('d1', 1), 'l4'),
  ];
  const express = gameMode('express')!;
  const ids = (list: BankEntry[]) => list.map(entryId);

  it('priorité : à revoir, puis nouveau ; maîtrisé et récent en dernier', () => {
    const picked = pickSession(express, entries, {
      due: [
        {
          moduleSlug: 'module-fictif',
          activityKey: 'd1',
          activityKind: 'quiz',
          dueOn: '2026-11-20',
          box: 1,
        },
      ],
      practiced: new Set(['module-fictif:a1', 'module-fictif:b1', 'module-fictif:d1']),
      mastered: new Set(['module-fictif:a1']),
      recent: new Set(['module-fictif:b1']),
      seed: 'graine',
    });
    expect(picked).toHaveLength(3);
    expect(ids(picked)).toContain('module-fictif:d1');
    expect(ids(picked)).toContain('module-fictif:c1');
    expect(ids(picked)).not.toContain('module-fictif:a1');
  });

  it('variété : une leçon différente par activité tant que possible', () => {
    const picked = pickSession(express, entries, { due: [], practiced: new Set(), seed: 'x' });
    expect(new Set(picked.map((item) => item.lessonId)).size).toBe(3);
  });

  it('stable pour une même partie, variable d’une partie à l’autre', () => {
    const context = { due: [], practiced: new Set<string>() };
    const one = ids(pickSession(express, entries, { ...context, seed: 's1' }));
    expect(ids(pickSession(express, entries, { ...context, seed: 's1' }))).toEqual(one);
    const seeds = ['s2', 's3', 's4', 's5', 's6'].map((seed) =>
      ids(pickSession(express, entries, { ...context, seed })).join(),
    );
    expect(new Set([one.join(), ...seeds]).size).toBeGreaterThan(1);
  });

  it('L’Ascension monte en difficulté et garde une question de réserve', () => {
    const pool = [
      entry('h', quiz('h', 2, 3), 'l1'),
      entry('e', quiz('e', 2, 1), 'l2'),
      entry('m', quiz('m', 2, 2), 'l3'),
    ];
    expect(allAscensionQuestions(pool)).toHaveLength(6);
    const questions = ascensionQuestions(pool, { due: [], practiced: new Set(), seed: 'z' }, 5);
    expect(questions).toHaveLength(5);
    const climb = questions.slice(0, -1).map((question) => question.difficulty);
    expect(climb).toEqual([...climb].sort((a, b) => a - b));
    expect(new Set(questions.map((question) => question.id)).size).toBe(5);
  });
});
