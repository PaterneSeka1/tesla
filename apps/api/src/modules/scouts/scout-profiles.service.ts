import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type BirthDateImpact,
  birthDateImpactQuerySchema,
  type ComputedStageSnapshot,
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
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type Prisma, type ScoutProfile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { assertCanAtWrite } from '../auth/write-authority.js';
import { todayCivil } from '../progression/age-rules.js';
import {
  computedStageOf,
  loadStageContext,
  type StageContext,
  withComputedStage,
} from '../progression/computed-stage.js';
import { PathwayService } from '../progression/pathway.service.js';
import {
  type AdminChange,
  type AdminSnapshot,
  assertAdminDates,
  assertCorrectionJustified,
  diffAdminFields,
  rejectStageInput,
} from './admin-changes.js';
import {
  scoutProfileNotFound,
  toIsoDate,
  toStageSummary,
  toUserSummary,
  userSummarySelect,
} from './presenters.js';

function matriculeAlreadyUsed(): ConflictException {
  return new ConflictException({
    code: 'MATRICULE_ALREADY_USED',
    message: 'Ce matricule est déjà attribué à un autre routier.',
  });
}

/** Relations nécessaires à l'affichage d'un routier en liste. */
const listInclude = {
  teamAssignments: { where: { endedAt: null }, include: { team: true }, take: 1 },
} as const satisfies Prisma.ScoutProfileInclude;

type ScoutWithRelations = Prisma.ScoutProfileGetPayload<{ include: typeof listInclude }>;

/** L'étape affichée est toujours l'étape calculée selon l'âge (D173). */
function toListItem(profile: ScoutWithRelations, context: StageContext): ScoutListItem {
  const team = profile.teamAssignments[0]?.team ?? null;
  const computed = computedStageOf(profile, context);
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    matricule: profile.matricule,
    isActive: profile.isActive,
    joinedAt: profile.joinedAt && toIsoDate(profile.joinedAt),
    stage: toStageSummary(computed.stage),
    stageReason: computed.reason,
    team: team && { id: team.id, name: team.name },
    hasAccount: profile.userId !== null,
  };
}

const day = (date: Date | null): string | null => date && toIsoDate(date);

function adminSnapshot(profile: ScoutProfile): AdminSnapshot {
  return {
    lastName: profile.lastName,
    firstName: profile.firstName,
    matricule: profile.matricule,
    birthDate: day(profile.birthDate),
    joinedAt: day(profile.joinedAt),
  };
}

const toDbDate = (value: string | null): Date | null =>
  value === null ? null : new Date(`${value}T00:00:00Z`);

function snapshotAt(birthDate: string | null, context: StageContext): ComputedStageSnapshot {
  const computed = computedStageOf({ id: null, birthDate: toDbDate(birthDate) }, context);
  return {
    age: computed.progression.age,
    stage: toStageSummary(computed.stage),
    stageReason: computed.reason,
    branchExitOn: computed.progression.branchExitOn,
  };
}

/**
 * Profils routiers : référence métier indépendante du compte (RM-001, RM-002).
 * Aucun compte n'est jamais créé ici ; un compte existant peut être rattaché plus tard.
 */
@Injectable()
export class ScoutProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pathway: PathwayService,
  ) {}

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
    const context = await loadStageContext(this.prisma);
    const orderBy = [{ lastName: 'asc' as const }, { firstName: 'asc' as const }];
    if (stageId) {
      // Étape calculée : filtrée en mémoire (aucune étape stockée ne peut contredire le calcul).
      const all = await this.prisma.scoutProfile.findMany({ where, include: listInclude, orderBy });
      const matching = withComputedStage(all, context, stageId === NONE_FILTER ? null : stageId);
      return {
        items: matching
          .slice((page - 1) * pageSize, page * pageSize)
          .map((profile) => toListItem(profile, context)),
        page,
        pageSize,
        total: matching.length,
      };
    }
    const [total, profiles] = await this.prisma.$transaction([
      this.prisma.scoutProfile.count({ where }),
      this.prisma.scoutProfile.findMany({
        where,
        include: listInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: profiles.map((profile) => toListItem(profile, context)),
      page,
      pageSize,
      total,
    };
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
      ...toListItem(profile, await loadStageContext(this.prisma)),
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
   * Inscrit un routier sans compte ; le compte pourra être rattaché plus tard. Administrateur ou
   * responsable plein en fonction (revérifié dans la transaction). Les informations absentes restent
   * non renseignées ; l'étape n'est jamais saisie (calculée selon l'âge).
   * Un homonyme exact (nom et prénoms, sans distinction de casse) exige une confirmation explicite.
   */
  async create(actor: Actor, input: CreateScoutProfileInput): Promise<ScoutProfile> {
    assertCan(actor, 'scout.create');
    rejectStageInput(input);
    const data = parseInput(createScoutProfileInputSchema, input);
    assertAdminDates(
      { birthDate: data.birthDate ?? null, joinedAt: data.joinedAt ?? null },
      todayCivil(),
    );
    let created: ScoutProfile;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await assertCanAtWrite(tx, actor, 'scout.create');
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
            birthDate: toDbDate(data.birthDate ?? null),
            joinedAt: toDbDate(data.joinedAt ?? null),
          },
        });
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
            metadata: {
              teamId: data.teamId ?? null,
              missing: (['matricule', 'birthDate', 'joinedAt'] as const).filter(
                (field) => data[field] === undefined || data[field] === null,
              ),
            },
          },
        });
        return profile;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw matriculeAlreadyUsed();
      throw error;
    }
    await this.pathway.syncCatchUps(created.id);
    return created;
  }

  /**
   * Gestion administrative d'une fiche (D173) : complétion libre d'une information absente ;
   * correction (remplacement ou retrait) avec motif et confirmation, ancienne et nouvelle valeurs
   * journalisées. Habilitation revérifiée au moment de l'écriture ; fiche verrouillée. Une
   * correction de la date de naissance recalcule l'étape (à la lecture) et le plan de rattrapage,
   * sans effacer ni réécrire aucune obligation, décision ou validation existante.
   */
  async update(
    actor: Actor,
    scoutProfileId: string,
    input: UpdateScoutProfileInput,
  ): Promise<ScoutProfile> {
    assertCan(actor, 'scout.update');
    rejectStageInput(input);
    const data = parseInput(updateScoutProfileInputSchema, input);
    let result: { profile: ScoutProfile; changes: AdminChange[] };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await assertCanAtWrite(tx, actor, 'scout.update');
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM scout_profiles WHERE id = ${scoutProfileId}::uuid FOR UPDATE`;
        if (locked.length === 0) throw scoutProfileNotFound();
        const previous = await tx.scoutProfile.findUniqueOrThrow({ where: { id: scoutProfileId } });
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
        const before = adminSnapshot(previous);
        const changes = diffAdminFields(before, data);
        if (changes.length === 0) return { profile: previous, changes };
        assertCorrectionJustified(changes, data);
        const next = { ...before, ...Object.fromEntries(changes.map((c) => [c.field, c.next])) };
        assertAdminDates({ birthDate: next.birthDate, joinedAt: next.joinedAt }, todayCivil());

        const profile = await tx.scoutProfile.update({
          where: { id: scoutProfileId },
          data: Object.fromEntries(
            changes.map(({ field, next: value }) => [
              field,
              field === 'birthDate' || field === 'joinedAt' ? toDbDate(value) : value,
            ]),
          ),
        });
        const completions = changes.filter((change) => change.kind === 'COMPLETION');
        const corrections = changes.filter((change) => change.kind === 'CORRECTION');
        if (completions.length > 0) {
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              action: 'scout_profile.completed',
              entityType: 'ScoutProfile',
              entityId: scoutProfileId,
              metadata: {
                changes: completions.map(({ field, next: value }) => ({ field, next: value })),
              },
            },
          });
        }
        if (corrections.length > 0) {
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              action: 'scout_profile.corrected',
              entityType: 'ScoutProfile',
              entityId: scoutProfileId,
              metadata: {
                reason: data.reason ?? null,
                changes: corrections.map(({ field, previous: old, next: value }) => ({
                  field,
                  previous: old,
                  next: value,
                })),
              },
            },
          });
        }
        return { profile, changes };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw matriculeAlreadyUsed();
      throw error;
    }
    if (result.changes.some((change) => change.field === 'birthDate')) {
      await this.pathway.syncCatchUps(scoutProfileId);
    }
    return result.profile;
  }

  /**
   * Aperçu, sans écriture, des conséquences d'une date de naissance corrigée : âge, étape et sortie
   * avant / après, nouvelles obligations de rattrapage et obligations à réexaminer.
   */
  async birthDateImpact(
    actor: Actor,
    scoutProfileId: string,
    query: unknown,
  ): Promise<BirthDateImpact> {
    assertCan(actor, 'scout.update');
    const { birthDate } = parseInput(birthDateImpactQuerySchema, query);
    const profile = await this.prisma.scoutProfile.findUnique({ where: { id: scoutProfileId } });
    if (!profile) throw scoutProfileNotFound();
    const context = await loadStageContext(this.prisma);
    const catchUps = await this.pathway.catchUpImpact(profile.id, birthDate, context);
    return {
      current: snapshotAt(day(profile.birthDate), context),
      next: snapshotAt(birthDate, context),
      ...catchUps,
    };
  }

  /**
   * Active ou désactive un profil. La désactivation clôt l'affectation d'équipe ouverte
   * (historique conservé) ; aucune donnée n'est supprimée.
   */
  async setActive(actor: Actor, scoutProfileId: string, active: boolean): Promise<ScoutProfile> {
    assertCan(actor, 'scout.setActive');
    return this.prisma.$transaction(async (tx) => {
      await assertCanAtWrite(tx, actor, 'scout.setActive');
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
        await assertCanAtWrite(tx, actor, 'scout.linkAccount');
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
    // Données pédagogiques : jamais l'administrateur, qui ne gère que les données administratives.
    assertCan(actor, 'progression.read');
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

// Défini dans `presenters.ts` (sans dépendance) pour éviter un import circulaire avec la progression.
export { scoutProfileNotFound } from './presenters.js';

function profileAlreadyLinked(): ConflictException {
  return new ConflictException({
    code: 'PROFILE_ALREADY_LINKED',
    message: 'Ce profil routier est déjà rattaché à un compte.',
  });
}
