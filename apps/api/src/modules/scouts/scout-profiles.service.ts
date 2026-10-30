import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type CreateScoutProfileInput,
  createScoutProfileInputSchema,
  type LinkAccountInput,
  linkAccountInputSchema,
  matriculeSchema,
  NONE_FILTER,
  type Paginated,
  type ScoutDetail,
  type ScoutListItem,
  type ScoutListQuery,
  scoutListQuerySchema,
  type ScoutPedagogicalHistory,
  type UpdateScoutProfileInput,
  updateScoutProfileInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan, can } from '../../common/permissions.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma, type ScoutProfile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toIsoDate, toStageSummary, toUserSummary, userSummarySelect } from './presenters.js';

function matriculeAlreadyUsed(): ConflictException {
  return new ConflictException({
    code: 'MATRICULE_ALREADY_USED',
    message: 'Ce matricule est déjà attribué à un autre routier.',
  });
}

function stageNotFound(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'STAGE_NOT_FOUND',
    message: 'Étape de progression inconnue.',
  });
}

/** Relations nécessaires à l'affichage d'un routier en liste. */
const listInclude = {
  currentStage: true,
  teamAssignments: { where: { endedAt: null }, include: { team: true }, take: 1 },
} as const satisfies Prisma.ScoutProfileInclude;

type ScoutWithRelations = Prisma.ScoutProfileGetPayload<{ include: typeof listInclude }>;

function toListItem(profile: ScoutWithRelations): ScoutListItem {
  const team = profile.teamAssignments[0]?.team ?? null;
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    matricule: profile.matricule,
    isActive: profile.isActive,
    joinedAt: toIsoDate(profile.joinedAt),
    stage: toStageSummary(profile.currentStage),
    team: team && { id: team.id, name: team.name },
    hasAccount: profile.userId !== null,
  };
}

/**
 * Profils routiers : référence métier indépendante du compte (RM-001, RM-002).
 * Aucun compte n'est jamais créé ici ; un compte existant peut être rattaché plus tard.
 */
@Injectable()
export class ScoutProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recherche par nom, prénoms ou matricule (chaque mot doit correspondre à l'un d'eux),
   * filtres par équipe, étape, statut et compte. Les routiers sans compte sont inclus.
   */
  async list(actor: Actor, query: ScoutListQuery): Promise<Paginated<ScoutListItem>> {
    assertCan(actor, 'scout.read');
    const { page, pageSize, search, teamId, stageId, status, account } = parseInput(
      scoutListQuerySchema,
      query,
    );
    const words = search?.split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.ScoutProfileWhereInput = {
      ...(status !== 'all' && { isActive: status === 'active' }),
      ...(account === 'with' && { userId: { not: null } }),
      ...(account === 'without' && { userId: null }),
      ...(stageId && { currentStageId: stageId === NONE_FILTER ? null : stageId }),
      ...(teamId === NONE_FILTER && { teamAssignments: { none: { endedAt: null } } }),
      ...(teamId &&
        teamId !== NONE_FILTER && { teamAssignments: { some: { teamId, endedAt: null } } }),
      AND: words.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
          { matricule: { contains: word.toUpperCase() } },
        ],
      })),
    };
    const [total, profiles] = await this.prisma.$transaction([
      this.prisma.scoutProfile.count({ where }),
      this.prisma.scoutProfile.findMany({
        where,
        include: listInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: profiles.map(toListItem), page, pageSize, total };
  }

  /** Fiche d'un routier. L'e-mail du compte rattaché n'est communiqué qu'au responsable. */
  async get(actor: Actor, scoutProfileId: string): Promise<ScoutDetail> {
    assertCan(actor, 'scout.read');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      include: { ...listInclude, user: true },
    });
    if (!profile) throw scoutProfileNotFound();
    return {
      ...toListItem(profile),
      birthDate: profile.birthDate ? toIsoDate(profile.birthDate) : null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      account: profile.user && {
        email: can(actor, 'scout.linkAccount') ? profile.user.email : null,
        isActive: profile.user.isActive,
        lastLoginAt: profile.user.lastLoginAt?.toISOString() ?? null,
      },
    };
  }

  /**
   * Inscrit un routier sans compte ; le compte pourra être rattaché plus tard.
   * Un homonyme exact (nom et prénoms, sans distinction de casse) exige une confirmation explicite.
   */
  async create(actor: Actor, input: CreateScoutProfileInput): Promise<ScoutProfile> {
    assertCan(actor, 'scout.create');
    const data = parseInput(createScoutProfileInputSchema, input);
    if (data.currentStageId) assertCan(actor, 'scout.setStage');
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!data.confirmDuplicate) {
          const homonym = await tx.scoutProfile.findFirst({
            where: {
              firstName: { equals: data.firstName, mode: 'insensitive' },
              lastName: { equals: data.lastName, mode: 'insensitive' },
            },
            select: { id: true },
          });
          if (homonym) {
            throw new ConflictException({
              code: 'POSSIBLE_DUPLICATE',
              message:
                'Un routier portant ces nom et prénoms existe déjà. Vérifiez avant de confirmer.',
            });
          }
        }
        if (data.teamId) {
          const team = await tx.team.findUnique({ where: { id: data.teamId } });
          if (!team) {
            throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Équipe introuvable.' });
          }
          if (team.archivedAt) {
            throw new ConflictException({
              code: 'TEAM_ARCHIVED',
              message: 'Cette équipe est archivée.',
            });
          }
        }
        const profile = await tx.scoutProfile.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            matricule: data.matricule ?? null,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            joinedAt: new Date(data.joinedAt),
            currentStageId: data.currentStageId ?? null,
            currentStageSince: data.currentStageId ? new Date(data.joinedAt) : null,
          },
        });
        if (data.currentStageId) {
          // Étape initiale : première entrée de l'historique structuré des étapes.
          await tx.scoutStageChange.create({
            data: {
              scoutProfileId: profile.id,
              kind: 'INSCRIPTION',
              toStageId: data.currentStageId,
              effectiveOn: new Date(data.joinedAt),
              decidedById: actor.userId,
              reason: 'Étape initiale saisie à l’inscription.',
            },
          });
        }
        if (data.teamId) {
          await tx.teamAssignment.create({
            data: {
              scoutProfileId: profile.id,
              teamId: data.teamId,
              startedAt: new Date(),
              assignedById: actor.userId,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'scout_profile.created',
            entityType: 'ScoutProfile',
            entityId: profile.id,
            metadata: { teamId: data.teamId ?? null, stageId: data.currentStageId ?? null },
          },
        });
        return profile;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw matriculeAlreadyUsed();
      if (isForeignKeyViolation(error)) throw stageNotFound();
      throw error;
    }
  }

  /**
   * Modifie une fiche. Le changement d'étape n'est plus accepté ici : c'est une décision motivée et
   * historisée (`POST /scouts/:id/stage-changes`, ScoutProgressionService.changeStage).
   */
  async update(
    actor: Actor,
    scoutProfileId: string,
    input: UpdateScoutProfileInput,
  ): Promise<ScoutProfile> {
    assertCan(actor, 'scout.update');
    const data = parseInput(updateScoutProfileInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.scoutProfile.findUnique({ where: { id: scoutProfileId } });
        if (!previous) throw scoutProfileNotFound();
        if (
          data.expectedUpdatedAt !== undefined &&
          previous.updatedAt.toISOString() !== new Date(data.expectedUpdatedAt).toISOString()
        ) {
          throw new ConflictException({
            code: 'SCOUT_PROFILE_CHANGED',
            message:
              'Cette fiche a été modifiée entre-temps. Consultez la version à jour avant de reprendre vos changements.',
          });
        }

        const stageChanged =
          data.currentStageId !== undefined && data.currentStageId !== previous.currentStageId;
        if (stageChanged) {
          assertCan(actor, 'scout.setStage');
          throw new UnprocessableEntityException({
            code: 'STAGE_CHANGE_REQUIRES_DECISION',
            message:
              'Le changement d’étape est une décision motivée : utilisez « Changer l’étape » sur la fiche de progression.',
          });
        }
        const matriculeChanged =
          data.matricule !== undefined && data.matricule !== previous.matricule;

        const profile = await tx.scoutProfile.update({
          where: { id: scoutProfileId },
          data: {
            ...(data.firstName !== undefined && { firstName: data.firstName }),
            ...(data.lastName !== undefined && { lastName: data.lastName }),
            ...(matriculeChanged && { matricule: data.matricule }),
            ...(data.birthDate !== undefined && {
              birthDate: data.birthDate ? new Date(data.birthDate) : null,
            }),
            ...(data.joinedAt !== undefined && { joinedAt: new Date(data.joinedAt) }),
          },
        });

        const audit = (action: string, metadata: Prisma.InputJsonValue) =>
          tx.auditLog.create({
            data: {
              actorId: actor.userId,
              action,
              entityType: 'ScoutProfile',
              entityId: scoutProfileId,
              metadata,
            },
          });
        if (matriculeChanged) {
          await audit('scout_profile.matricule_set', {
            previous: previous.matricule,
            next: profile.matricule,
          });
        }
        const identityFields = (['firstName', 'lastName', 'birthDate', 'joinedAt'] as const).filter(
          (field) => data[field] !== undefined,
        );
        if (identityFields.length > 0) {
          await audit('scout_profile.updated', { fields: identityFields });
        }
        return profile;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw matriculeAlreadyUsed();
      if (isForeignKeyViolation(error)) throw stageNotFound();
      throw error;
    }
  }

  /**
   * Active ou désactive un profil. La désactivation clôt l'affectation d'équipe ouverte
   * (historique conservé) ; aucune donnée n'est supprimée.
   */
  async setActive(actor: Actor, scoutProfileId: string, active: boolean): Promise<ScoutProfile> {
    assertCan(actor, 'scout.setActive');
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ is_active: boolean }[]>`
        SELECT is_active FROM scout_profiles WHERE id = ${scoutProfileId}::uuid FOR UPDATE`;
      if (rows.length === 0) throw scoutProfileNotFound();
      if (rows[0]!.is_active === active) {
        throw new ConflictException({
          code: active ? 'SCOUT_ALREADY_ACTIVE' : 'SCOUT_ALREADY_INACTIVE',
          message: active ? 'Ce routier est déjà actif.' : 'Ce routier est déjà désactivé.',
        });
      }
      let closedAssignmentId: string | null = null;
      if (!active) {
        const now = new Date();
        const open = await tx.teamAssignment.findFirst({
          where: { scoutProfileId, endedAt: null },
        });
        if (open) {
          if (open.startedAt >= now) {
            throw new UnprocessableEntityException({
              code: 'INVALID_ASSIGNMENT_DATE',
              message: 'L’affectation en cours commence dans le futur : modifiez-la d’abord.',
            });
          }
          await tx.teamAssignment.update({
            where: { id: open.id },
            data: { endedAt: now, endedById: actor.userId },
          });
          closedAssignmentId = open.id;
        }
      }
      const profile = await tx.scoutProfile.update({
        where: { id: scoutProfileId },
        data: { isActive: active },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: active ? 'scout_profile.activated' : 'scout_profile.deactivated',
          entityType: 'ScoutProfile',
          entityId: scoutProfileId,
          metadata: { closedAssignmentId },
        },
      });
      return profile;
    });
  }

  /** Attribue, corrige ou retire (chaîne vide) le matricule. Jamais généré par l'application. */
  async setMatricule(
    actor: Actor,
    scoutProfileId: string,
    rawMatricule: string,
  ): Promise<ScoutProfile> {
    assertCan(actor, 'scout.setMatricule');
    const matricule = parseInput(matriculeSchema, rawMatricule);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.scoutProfile.findUnique({ where: { id: scoutProfileId } });
        if (!previous) throw scoutProfileNotFound();
        const profile = await tx.scoutProfile.update({
          where: { id: scoutProfileId },
          data: { matricule },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'scout_profile.matricule_set',
            entityType: 'ScoutProfile',
            entityId: scoutProfileId,
            metadata: { previous: previous.matricule, next: matricule },
          },
        });
        return profile;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw matriculeAlreadyUsed();
      throw error;
    }
  }

  async findByMatricule(actor: Actor, rawMatricule: string): Promise<ScoutProfile | null> {
    assertCan(actor, 'scout.read');
    const matricule = parseInput(matriculeSchema, rawMatricule);
    if (matricule === null) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Matricule requis.' });
    }
    return this.prisma.scoutProfile.findUnique({ where: { matricule } });
  }

  /** Rattache le compte routier désigné par son e-mail (vérifications de `linkAccount`). */
  async linkAccountByEmail(
    actor: Actor,
    scoutProfileId: string,
    input: LinkAccountInput,
  ): Promise<ScoutProfile> {
    assertCan(actor, 'scout.linkAccount');
    const { email } = parseInput(linkAccountInputSchema, input);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
    }
    return this.linkAccount(actor, scoutProfileId, user.id);
  }

  /**
   * Rattache un compte routier à un profil existant. Le profil (et tout son historique) est conservé :
   * aucun second profil n'est créé.
   */
  async linkAccount(actor: Actor, scoutProfileId: string, userId: string): Promise<ScoutProfile> {
    assertCan(actor, 'scout.linkAccount');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await tx.scoutProfile.findUnique({ where: { id: scoutProfileId } });
        if (!profile) throw scoutProfileNotFound();
        if (profile.userId !== null) {
          throw profileAlreadyLinked();
        }
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) {
          throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Compte introuvable.' });
        }
        if (user.role !== 'ROUTIER') {
          throw new ConflictException({
            code: 'ACCOUNT_NOT_ROUTIER',
            message: 'Seul un compte routier peut être rattaché à un profil routier.',
          });
        }
        // Mise à jour conditionnelle : un rattachement concurrent du même profil échoue au lieu d'écraser le premier.
        const { count } = await tx.scoutProfile.updateMany({
          where: { id: scoutProfileId, userId: null },
          data: { userId },
        });
        if (count === 0) throw profileAlreadyLinked();
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'scout_profile.account_linked',
            entityType: 'ScoutProfile',
            entityId: scoutProfileId,
            metadata: { userId },
          },
        });
        return tx.scoutProfile.findUniqueOrThrow({ where: { id: scoutProfileId } });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'ACCOUNT_ALREADY_LINKED',
          message: 'Ce compte est déjà rattaché à un autre profil routier.',
        });
      }
      throw error;
    }
  }

  /**
   * Historique pédagogique réellement enregistré : tentatives d'évaluation (tous modes) et
   * historique structuré des étapes (`scout_stage_changes`). Aucune donnée n'est déduite ni simulée.
   */
  async pedagogicalHistory(actor: Actor, scoutProfileId: string): Promise<ScoutPedagogicalHistory> {
    assertCan(actor, 'scout.read');
    const profile = await this.prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
      select: { id: true },
    });
    if (!profile) throw scoutProfileNotFound();

    const [attempts, stageChanges] = await Promise.all([
      this.prisma.evaluationAttempt.findMany({
        where: { scoutProfileId },
        include: { evaluation: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scoutStageChange.findMany({
        where: { scoutProfileId },
        include: { fromStage: true, toStage: true, decidedBy: userSummarySelect },
        orderBy: { decidedAt: 'desc' },
      }),
    ]);

    return {
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        code: attempt.code,
        evaluationTitle: attempt.evaluation.title,
        mode: attempt.mode,
        status: attempt.status,
        completedAt: attempt.completedAt?.toISOString() ?? null,
        createdAt: attempt.createdAt.toISOString(),
      })),
      stageChanges: stageChanges.map((change) => ({
        at: change.decidedAt.toISOString(),
        from: toStageSummary(change.fromStage),
        to: toStageSummary(change.toStage),
        by: toUserSummary(change.decidedBy),
      })),
    };
  }
}

export function scoutProfileNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'SCOUT_PROFILE_NOT_FOUND',
    message: 'Routier introuvable.',
  });
}

function profileAlreadyLinked(): ConflictException {
  return new ConflictException({
    code: 'PROFILE_ALREADY_LINKED',
    message: 'Ce profil routier est déjà rattaché à un compte.',
  });
}
