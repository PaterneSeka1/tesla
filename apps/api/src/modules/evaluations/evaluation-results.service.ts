import { Injectable } from '@nestjs/common';
import {
  type EvaluationQuestionResult,
  type EvaluationResults,
  FINISHED_ATTEMPT_STATUSES,
  roundPoints,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { parseId } from '../../common/validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toStageSummary } from '../scouts/presenters.js';
import { evaluationNotFound } from './evaluation-common.js';

const FINISHED = new Set<string>(FINISHED_ATTEMPT_STATUSES);

/**
 * Résultats d'un questionnaire pour l'encadrement (D139) : lecture seule, calculée à la demande
 * sur les tentatives et réponses enregistrées. Tout l'encadrement (`attempt.readAny`) ; jamais un
 * routier. Ne modifie aucune note, aucun statut, aucune étape.
 */
@Injectable()
export class EvaluationResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async results(actor: Actor, evaluationId: string): Promise<EvaluationResults> {
    // Notes et bonnes réponses agrégées : corrigé confidentiel, responsable plein seulement (D161).
    assertCan(actor, 'attempt.answerKey');
    const id = parseId(evaluationId);
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: { stage: true, publishedVersion: { select: { id: true, version: true } } },
    });
    if (!evaluation) throw evaluationNotFound();

    const attempts = await this.prisma.evaluationAttempt.findMany({
      where: { evaluationId: id, status: { not: 'ANNULEE' } },
      include: {
        scoutProfile: { select: { id: true, firstName: true, lastName: true } },
        version: { select: { id: true, version: true } },
        attemptAnswers: true,
      },
    });
    const finished = attempts.filter((attempt) => FINISHED.has(attempt.status));
    // Passations non remises (préparées ou en cours) ; les copies remises sont comptées à part.
    const open = attempts.filter(
      (attempt) => attempt.status === 'PREPAREE' || attempt.status === 'EN_COURS',
    );
    const participantIds = new Set(finished.map((attempt) => attempt.scoutProfileId));

    const concernedRows = await this.prisma.scoutProfile.findMany({
      where: { isActive: true, membershipStatus: 'ACTIF', currentStageId: evaluation.stageId },
      select: { id: true },
    });
    const notParticipated = concernedRows.filter((row) => !participantIds.has(row.id)).length;

    // Version détaillée : la publiée, sinon celle de la copie terminée la plus récente.
    const latest = [...finished].sort(
      (a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
    )[0];
    const detailed = evaluation.publishedVersion ?? latest?.version ?? null;
    const questionRows = detailed
      ? await this.prisma.evaluationQuestion.findMany({
          where: { versionId: detailed.id },
          include: { options: { orderBy: { position: 'asc' } } },
          orderBy: { position: 'asc' },
        })
      : [];

    const resultAttempts = finished
      .map((attempt) => {
        const pointsByQuestion = new Map(
          attempt.attemptAnswers.map((answer) => [
            answer.questionId,
            answer.awardedPoints === null ? null : Number(answer.awardedPoints),
          ]),
        );
        const score = roundPoints(
          [...pointsByQuestion.values()].reduce<number>((sum, value) => sum + (value ?? 0), 0),
        );
        return {
          code: attempt.code,
          scout: attempt.scoutProfile,
          mode: attempt.mode,
          status: attempt.status,
          version: attempt.version.version,
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
          score,
          maxScore: attempt.maxScore === null ? 0 : Number(attempt.maxScore),
          complete:
            attempt.attemptAnswers.length > 0 &&
            [...pointsByQuestion.values()].every((value) => value !== null),
        };
      })
      .sort(
        (a, b) =>
          a.scout.lastName.localeCompare(b.scout.lastName, 'fr') ||
          a.scout.firstName.localeCompare(b.scout.firstName, 'fr') ||
          a.code.localeCompare(b.code),
      );

    const graded = resultAttempts.filter((attempt) => attempt.complete && attempt.maxScore > 0);
    const averagePercent =
      graded.length === 0
        ? null
        : roundPoints(
            (graded.reduce((sum, attempt) => sum + attempt.score / attempt.maxScore, 0) /
              graded.length) *
              100,
          );

    const versionCopies = detailed
      ? finished.filter((attempt) => attempt.version.id === detailed.id)
      : [];
    const questions: EvaluationQuestionResult[] = questionRows.map((question) => {
      const points = Number(question.points);
      const answers = versionCopies.map((attempt) => ({
        code: attempt.code,
        answer: attempt.attemptAnswers.find((row) => row.questionId === question.id),
      }));
      let fullPoints = 0;
      let partialPoints = 0;
      let noPoints = 0;
      let pendingGrade = 0;
      let answered = 0;
      const chosen = new Map<string, number>();
      for (const { answer } of answers) {
        if (answer && (answer.selectedOptionIds.length > 0 || answer.textAnswer)) answered++;
        for (const optionId of answer?.selectedOptionIds ?? [])
          chosen.set(optionId, (chosen.get(optionId) ?? 0) + 1);
        const awarded = answer?.awardedPoints == null ? null : Number(answer.awardedPoints);
        if (awarded === null) pendingGrade++;
        else if (awarded >= points) fullPoints++;
        else if (awarded > 0) partialPoints++;
        else noPoints++;
      }
      const gradedCount = fullPoints + partialPoints + noPoints;
      return {
        position: question.position,
        type: question.type,
        prompt: question.prompt,
        points,
        copies: versionCopies.length,
        answered,
        fullPoints,
        partialPoints,
        noPoints,
        pendingGrade,
        successRate: gradedCount === 0 ? null : roundPoints(fullPoints / gradedCount),
        options: question.options.map((option) => ({
          label: option.label,
          isCorrect: option.isCorrect,
          chosen: chosen.get(option.id) ?? 0,
        })),
        texts: answers
          .filter(({ answer }) => answer?.textAnswer)
          .map(({ code, answer }) => ({
            code,
            text: answer!.textAnswer!,
            awardedPoints: answer!.awardedPoints === null ? null : Number(answer!.awardedPoints),
          })),
      };
    });

    return {
      evaluation: {
        id: evaluation.id,
        title: evaluation.title,
        stage: toStageSummary(evaluation.stage)!,
        version: detailed?.version ?? null,
      },
      concerned: concernedRows.length,
      participants: participantIds.size,
      notParticipated,
      finishedAttempts: finished.length,
      openAttempts: open.length,
      averagePercent,
      attempts: resultAttempts,
      questions,
    };
  }
}
