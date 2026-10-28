import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateScoutProfileInput,
  createScoutProfileInputSchema,
  matriculeSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { type ScoutProfile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

function matriculeAlreadyUsed(): ConflictException {
  return new ConflictException({
    code: 'MATRICULE_ALREADY_USED',
    message: 'Ce matricule est déjà attribué à un autre routier.',
  });
}

/**
 * Profils routiers : référence métier indépendante du compte (RM-001, RM-002).
 * Aucune route exposée tant que l'authentification n'est pas opérationnelle.
 */
@Injectable()
export class ScoutProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inscrit un routier sans compte ; le compte pourra être rattaché plus tard. */
  async create(actor: Actor, input: CreateScoutProfileInput): Promise<ScoutProfile> {
    assertCan(actor, 'scout.create');
    const data = parseInput(createScoutProfileInputSchema, input);
    try {
      return await this.prisma.scoutProfile.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          matricule: data.matricule ?? null,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          joinedAt: new Date(data.joinedAt),
          currentStageId: data.currentStageId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw matriculeAlreadyUsed();
      throw error;
    }
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
