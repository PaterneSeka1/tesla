import { UnprocessableEntityException } from '@nestjs/common';
import {
  type AttemptAnswerInput,
  type attemptAnswerInputSchema,
  type Eligibility,
  gradeObjectiveAnswer,
  isObjectiveQuestion,
  totalScore,
} from '@tesla/shared';
import { type z } from 'zod';
import { type Prisma } from '../../generated/prisma/client.js';
import { computeEligibility } from './eligibility.js';
import { questionInclude } from './evaluation-common.js';
import {
  effectiveMembership,
  loadRuleSetRow,
  todayCivil,
  toSnapshot,
} from '../progression/age-rules.js';

export type VersionQuestion = Prisma.EvaluationQuestionGetPayload<{
  include: typeof questionInclude;
}>;

type ParsedAnswer = z.output<typeof attemptAnswerInputSchema>;

export interface NormalizedAnswer {
  questionId: string;
  optionIds: string[];
  text: string | null;
}

export function loadVersionQuestions(
  tx: Prisma.TransactionClient,
  versionId: string,
): Promise<VersionQuestion[]> {
  return tx.evaluationQuestion.findMany({
    where: { versionId },
    orderBy: { position: 'asc' },
    include: questionInclude,
  });
}

function invalidAnswer(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ code: 'INVALID_ANSWER', message });
}

/**
 * Contrôle des réponses contre la version exacte de la tentative : question de la version,
 * propositions de la question, une seule proposition pour un choix unique ou un vrai/faux,
 * texte réservé aux questions ouvertes. Empêche toute réponse à une autre version.
 */
export function normalizeAnswers(
  questions: readonly VersionQuestion[],
  answers: readonly (ParsedAnswer | AttemptAnswerInput)[],
): NormalizedAnswer[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  return answers.map((answer) => {
    const question = byId.get(answer.questionId);
    if (!question)
      throw invalidAnswer('Une réponse ne correspond à aucune question de cette version.');
    if (seen.has(question.id)) throw invalidAnswer('Une question a reçu deux réponses.');
    seen.add(question.id);
    const optionIds = [...new Set(answer.optionIds ?? [])];
    const text = typeof answer.text === 'string' && answer.text.trim() !== '' ? answer.text : null;
    if (isObjectiveQuestion(question.type)) {
      const known = new Set(question.options.map((option) => option.id));
      if (!optionIds.every((id) => known.has(id))) {
        throw invalidAnswer('Proposition inconnue pour cette question.');
      }
      if (question.type !== 'CHOIX_MULTIPLE' && optionIds.length > 1) {
        throw invalidAnswer('Une seule proposition est attendue pour cette question.');
      }
      if (text !== null) throw invalidAnswer('Cette question attend un choix, pas un texte.');
    } else if (optionIds.length > 0) {
      throw invalidAnswer('Cette question attend une réponse rédigée.');
    }
    return { questionId: question.id, optionIds, text };
  });
}

export async function upsertAnswers(
  tx: Prisma.TransactionClient,
  attemptId: string,
  answers: readonly NormalizedAnswer[],
): Promise<void> {
  for (const answer of answers) {
    await tx.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: answer.questionId } },
      create: {
        attemptId,
        questionId: answer.questionId,
        selectedOptionIds: answer.optionIds,
        textAnswer: answer.text,
      },
      update: { selectedOptionIds: answer.optionIds, textAnswer: answer.text },
    });
  }
}

/**
 * Correction déterministe des questions objectives : une ligne de réponse par question (vide si
 * le routier n'a pas répondu), points calculés par `gradeObjectiveAnswer`. Les questions ouvertes
 * gardent la note saisie par un correcteur (ou null). Renvoie le total.
 */
export async function gradeObjectiveQuestions(
  tx: Prisma.TransactionClient,
  attemptId: string,
  questions: readonly VersionQuestion[],
): Promise<{ score: number; maxScore: number; complete: boolean }> {
  const existing = await tx.attemptAnswer.findMany({ where: { attemptId } });
  const byQuestion = new Map(existing.map((answer) => [answer.questionId, answer]));
  const items: { points: number; awardedPoints: number | null }[] = [];
  for (const question of questions) {
    const points = Number(question.points);
    const answer = byQuestion.get(question.id);
    if (isObjectiveQuestion(question.type)) {
      const awarded = gradeObjectiveAnswer(
        {
          type: question.type,
          points,
          scoringPolicy: question.scoringPolicy,
          options: question.options,
        },
        answer?.selectedOptionIds ?? [],
      )!;
      await tx.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: question.id } },
        create: {
          attemptId,
          questionId: question.id,
          selectedOptionIds: [],
          awardedPoints: awarded,
          autoScored: true,
        },
        update: { awardedPoints: awarded, autoScored: true },
      });
      items.push({ points, awardedPoints: awarded });
    } else {
      if (!answer) {
        await tx.attemptAnswer.create({
          data: { attemptId, questionId: question.id, selectedOptionIds: [] },
        });
      }
      items.push({
        points,
        awardedPoints: answer?.awardedPoints == null ? null : Number(answer.awardedPoints),
      });
    }
  }
  return totalScore(items);
}

/** Faits d'éligibilité lus dans la transaction appelante (lecture cohérente avec la création). */
export async function loadEligibility(
  tx: Prisma.TransactionClient,
  input: {
    profile: {
      id: string;
      isActive: boolean;
      currentStageId: string | null;
      birthDate: Date | null;
      membershipStatus: 'ACTIF' | 'SORTI';
    } | null;
    evaluation: { id: string; stageId: string; moduleId?: string | null };
    maxAttempts: number | null;
    now: Date;
  },
): Promise<Eligibility> {
  const { profile } = input;
  const rules = profile ? await loadRuleSetRow(tx, todayCivil(input.now)) : null;
  const membership = profile
    ? effectiveMembership(profile, rules && toSnapshot(rules), todayCivil(input.now))
    : undefined;
  const openCatchUp =
    profile && input.evaluation.moduleId
      ? (await tx.catchUpObligation.count({
          where: {
            scoutProfileId: profile.id,
            moduleId: input.evaluation.moduleId,
            decision: null,
          },
        })) > 0
      : false;
  // Requêtes successives : une transaction interactive n'exécute qu'une requête à la fois.
  const attempts = profile
    ? await tx.evaluationAttempt.findMany({
        where: { scoutProfileId: profile.id, evaluationId: input.evaluation.id },
        select: { id: true, code: true, mode: true, status: true },
      })
    : [];
  const waivers = profile
    ? await tx.evaluationWaiver.findMany({
        where: { scoutProfileId: profile.id, evaluationId: input.evaluation.id },
      })
    : [];
  return computeEligibility({
    profile,
    membership,
    openCatchUp,
    evaluationStageId: input.evaluation.stageId,
    maxAttempts: input.maxAttempts,
    attempts,
    waivers,
    now: input.now,
  });
}
