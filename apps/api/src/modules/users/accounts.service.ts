import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Account,
  type AccountLink,
  accountListQuerySchema,
  type AccountListQuery,
  type AccountStatus,
  type AccountTokenInfo,
  accountTokenInputSchema,
  type AccountTokenPurpose,
  type AccountWithLink,
  completeAccountTokenInputSchema,
  createAccountInputSchema,
  deactivateAccountInputSchema,
  type Paginated,
  type Role,
  updateAccountInputSchema,
} from '@tesla/shared';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput } from '../../common/validation.js';
import { ENV } from '../../config/config.module.js';
import { type Env } from '../../config/env.js';
import { type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LoginRateLimiter } from '../auth/login-rate-limiter.js';
import { hashPassword } from '../auth/password.js';
import { generateSessionToken, hashSessionToken } from '../auth/session-token.js';

type Tx = Prisma.TransactionClient;

const accountSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  passwordHash: true,
  lastLoginAt: true,
  createdAt: true,
  scoutProfile: { select: { id: true } },
} as const;

type AccountRow = Prisma.UserGetPayload<{ select: typeof accountSelect }>;

export function accountStatus(user: { isActive: boolean; passwordHash: string | null }) {
  if (!user.isActive) return 'DESACTIVE' as const;
  return user.passwordHash === null ? ('A_ACTIVER' as const) : ('ACTIF' as const);
}

const STATUS_WHERE: Record<AccountStatus, Prisma.UserWhereInput> = {
  A_ACTIVER: { isActive: true, passwordHash: null },
  ACTIF: { isActive: true, passwordHash: { not: null } },
  DESACTIVE: { isActive: false },
};

const accountNotFound = () =>
  new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Compte introuvable.' });

const invalidLink = () =>
  new BadRequestException({
    code: 'INVALID_ACCOUNT_LINK',
    message: 'Ce lien est invalide, expiré ou déjà utilisé. Demandez-en un nouveau.',
  });

/**
 * Cycle de vie des comptes (D118–D121). Périmètre : l'administration technique gère tous les
 * comptes ; une décision officielle (plein ou délégation `account.manage`) ne couvre que les comptes
 * routiers. Aucun compte n'est supprimé ; chaque opération sensible est journalisée dans la même
 * transaction.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: LoginRateLimiter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Rôles qu'un acteur peut gérer : tous pour l'administration technique, `ROUTIER` sinon. */
  private manageableRoles(actor: Actor): readonly Role[] {
    return actor.role === 'ADMINISTRATEUR'
      ? ['ROUTIER', 'ENCADREMENT', 'ADMINISTRATEUR']
      : ['ROUTIER'];
  }

  private assertScope(actor: Actor, role: string): void {
    if (!(this.manageableRoles(actor) as readonly string[]).includes(role)) {
      throw new ForbiddenException({
        code: 'ACCOUNT_OUT_OF_SCOPE',
        message: 'Ce compte relève de l’administration technique.',
      });
    }
  }

  private async toAccount(row: AccountRow, db: Tx | PrismaService = this.prisma): Promise<Account> {
    const activeSessions = await db.session.count({
      where: { userId: row.id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role as Role,
      status: accountStatus(row),
      scoutProfileId: row.scoutProfile?.id ?? null,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      activeSessions,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async findInScope(actor: Actor, id: string, db: Tx | PrismaService = this.prisma) {
    const row = await db.user.findUnique({ where: { id }, select: accountSelect });
    // Hors périmètre : même réponse qu'un compte inexistant (pas d'énumération des comptes d'encadrement).
    if (!row || !(this.manageableRoles(actor) as readonly string[]).includes(row.role)) {
      throw accountNotFound();
    }
    return row;
  }

  async list(actor: Actor, query: AccountListQuery): Promise<Paginated<Account>> {
    assertCan(actor, 'account.read');
    const { page, pageSize, search, role, status } = parseInput(accountListQuerySchema, query);
    const roles = this.manageableRoles(actor);
    const where: Prisma.UserWhereInput = {
      role: { in: role ? roles.filter((r) => r === role) : [...roles] },
      ...(status && STATUS_WHERE[status]),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: accountSelect,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: await Promise.all(rows.map((row) => this.toAccount(row))),
      page,
      pageSize,
      total,
    };
  }

  async get(actor: Actor, id: string): Promise<Account> {
    assertCan(actor, 'account.read');
    return this.toAccount(await this.findInScope(actor, id));
  }

  /**
   * Crée un compte sans mot de passe et émet son lien d'activation. Avec `scoutProfileId`, le compte
   * routier est rattaché à la fiche existante dans la même transaction (RM-001 : jamais de second profil).
   */
  async create(actor: Actor, input: unknown): Promise<AccountWithLink> {
    assertCan(actor, 'account.manage');
    const data = parseInput(createAccountInputSchema, input);
    this.assertScope(actor, data.role);
    if (data.scoutProfileId) assertCan(actor, 'scout.linkAccount');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
          },
          select: { id: true },
        });
        if (data.scoutProfileId) {
          const { count } = await tx.scoutProfile.updateMany({
            where: { id: data.scoutProfileId, userId: null },
            data: { userId: user.id },
          });
          if (count === 0) {
            const exists = await tx.scoutProfile.count({ where: { id: data.scoutProfileId } });
            throw exists
              ? new ConflictException({
                  code: 'PROFILE_ALREADY_LINKED',
                  message: 'Cette fiche est déjà rattachée à un compte.',
                })
              : new NotFoundException({
                  code: 'SCOUT_PROFILE_NOT_FOUND',
                  message: 'Fiche routier introuvable.',
                });
          }
          await tx.auditLog.create({
            data: {
              actorId: actor.userId,
              action: 'scout_profile.account_linked',
              entityType: 'ScoutProfile',
              entityId: data.scoutProfileId,
              metadata: { userId: user.id },
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'account.created',
            entityType: 'User',
            entityId: user.id,
            metadata: { role: data.role, scoutProfileId: data.scoutProfileId ?? null },
          },
        });
        const link = await this.issueLink(tx, user.id, 'ACTIVATION', actor.userId);
        const row = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          select: accountSelect,
        });
        return { account: await this.toAccount(row, tx), link };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'ACCOUNT_EXISTS',
          message: 'Un compte utilise déjà cette adresse e-mail.',
        });
      }
      throw error;
    }
  }

  async update(actor: Actor, id: string, input: unknown): Promise<Account> {
    assertCan(actor, 'account.manage');
    const data = parseInput(updateAccountInputSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.findInScope(actor, id, tx);
        const row = await tx.user.update({ where: { id }, data, select: accountSelect });
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'account.updated',
            entityType: 'User',
            entityId: id,
            metadata: {
              fields: Object.keys(data),
              ...(data.email && data.email !== before.email && { previousEmail: before.email }),
            },
          },
        });
        return this.toAccount(row, tx);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'ACCOUNT_EXISTS',
          message: 'Un compte utilise déjà cette adresse e-mail.',
        });
      }
      throw error;
    }
  }

  /**
   * Nouveau lien : activation si le mot de passe n'a jamais été défini, réinitialisation sinon.
   * Les liens précédents non utilisés sont révoqués. Les sessions ouvertes ne sont pas touchées :
   * elles le seront à l'utilisation du lien.
   */
  async issueAccountLink(actor: Actor, id: string): Promise<AccountWithLink> {
    assertCan(actor, 'account.manage');
    return this.prisma.$transaction(async (tx) => {
      const row = await this.findInScope(actor, id, tx);
      if (!row.isActive) {
        throw new ConflictException({
          code: 'ACCOUNT_INACTIVE',
          message: 'Réactivez le compte avant d’émettre un lien.',
        });
      }
      const purpose = row.passwordHash === null ? 'ACTIVATION' : 'REINITIALISATION';
      const link = await this.issueLink(tx, id, purpose, actor.userId);
      return { account: await this.toAccount(row, tx), link };
    });
  }

  async deactivate(actor: Actor, id: string, input: unknown): Promise<Account> {
    assertCan(actor, 'account.manage');
    const { reason } = parseInput(deactivateAccountInputSchema, input);
    if (id === actor.userId) {
      throw new ConflictException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'Vous ne pouvez pas désactiver votre propre compte.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await this.findInScope(actor, id, tx);
      if (!row.isActive) return this.toAccount(row, tx);
      if (row.role === 'ADMINISTRATEUR') {
        // Verrou sur les comptes d'administration : deux désactivations simultanées ne laissent pas zéro administrateur.
        await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMINISTRATEUR' FOR UPDATE`;
        const others = await tx.user.count({
          where: { role: 'ADMINISTRATEUR', isActive: true, id: { not: id } },
        });
        if (others === 0) {
          throw new ConflictException({
            code: 'LAST_ADMINISTRATOR',
            message: 'Le dernier compte d’administration technique ne peut pas être désactivé.',
          });
        }
      }
      const now = new Date();
      const updated = await tx.user.update({
        where: { id },
        data: { isActive: false },
        select: accountSelect,
      });
      const sessions = await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.accountToken.updateMany({
        where: { userId: id, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'account.deactivated',
          entityType: 'User',
          entityId: id,
          metadata: { reason, revokedSessions: sessions.count },
        },
      });
      return this.toAccount(updated, tx);
    });
  }

  async reactivate(actor: Actor, id: string): Promise<Account> {
    assertCan(actor, 'account.manage');
    return this.prisma.$transaction(async (tx) => {
      const row = await this.findInScope(actor, id, tx);
      if (row.isActive) return this.toAccount(row, tx);
      const updated = await tx.user.update({
        where: { id },
        data: { isActive: true },
        select: accountSelect,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'account.reactivated',
          entityType: 'User',
          entityId: id,
        },
      });
      return this.toAccount(updated, tx);
    });
  }

  /** Ferme toutes les sessions du compte (appareil perdu, compte compromis). */
  async revokeSessions(actor: Actor, id: string): Promise<{ revoked: number }> {
    assertCan(actor, 'account.manage');
    return this.prisma.$transaction(async (tx) => {
      await this.findInScope(actor, id, tx);
      const { count } = await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'account.sessions_revoked',
          entityType: 'User',
          entityId: id,
          metadata: { revoked: count },
        },
      });
      return { revoked: count };
    });
  }

  /** Jeton à usage unique ; seul son hash est conservé. Révoque les liens précédents du compte. */
  private async issueLink(
    tx: Tx,
    userId: string,
    purpose: AccountTokenPurpose,
    createdById: string | null,
  ): Promise<AccountLink> {
    const now = new Date();
    await tx.accountToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + this.env.ACCOUNT_LINK_TTL_HOURS * 3_600_000);
    await tx.accountToken.create({
      data: { userId, purpose, tokenHash: hashSessionToken(token), expiresAt, createdById },
    });
    await tx.auditLog.create({
      data: {
        actorId: createdById,
        action: 'account.link_issued',
        entityType: 'User',
        entityId: userId,
        metadata: { purpose, expiresAt: expiresAt.toISOString() },
      },
    });
    return { token, purpose, expiresAt: expiresAt.toISOString() };
  }

  private async findUsableToken(token: string) {
    const row = await this.prisma.accountToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { select: { firstName: true, isActive: true } } },
    });
    if (!row || row.usedAt || row.revokedAt || row.expiresAt <= new Date() || !row.user.isActive) {
      return null;
    }
    return row;
  }

  /** Vérification d'un lien avant la saisie du mot de passe (route publique, limitée par adresse IP). */
  async inspectToken(input: unknown, ip: string): Promise<AccountTokenInfo> {
    const keys = this.limiter.tokenKeys(ip);
    await this.limiter.assertAllowed(keys);
    const { token } = parseInput(accountTokenInputSchema, input);
    const row = await this.findUsableToken(token);
    if (!row) {
      await this.limiter.recordFailure(keys);
      throw invalidLink();
    }
    return {
      purpose: row.purpose,
      firstName: row.user.firstName,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /**
   * Définit le mot de passe du titulaire du lien. Le jeton est consommé par une mise à jour
   * conditionnelle (deux envois simultanés : un seul réussit) ; toutes les sessions existantes
   * sont révoquées.
   */
  async completeToken(input: unknown, ip: string): Promise<void> {
    const keys = this.limiter.tokenKeys(ip);
    await this.limiter.assertAllowed(keys);
    const { token, password } = parseInput(completeAccountTokenInputSchema, input);
    const row = await this.findUsableToken(token);
    if (!row) {
      await this.limiter.recordFailure(keys);
      throw invalidLink();
    }
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.accountToken.updateMany({
        where: { id: row.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (count === 0) throw invalidLink();
      const user = await tx.user.updateMany({
        where: { id: row.userId, isActive: true },
        data: { passwordHash },
      });
      if (user.count === 0) throw invalidLink();
      await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: row.userId,
          action: row.purpose === 'ACTIVATION' ? 'account.activated' : 'account.password_reset',
          entityType: 'User',
          entityId: row.userId,
        },
      });
    });
  }

  /**
   * Installation et secours (ligne de commande, accès au serveur requis) : crée le premier compte
   * d'administration technique, ou émet un lien de réinitialisation pour un administrateur existant.
   * Refuse de créer un administrateur supplémentaire lorsqu'un administrateur actif existe déjà :
   * les suivants se créent depuis l'application.
   */
  async bootstrapAdministrator(input: {
    email: string;
    firstName: string;
    lastName: string;
    recover: boolean;
  }): Promise<AccountLink> {
    const data = parseInput(createAccountInputSchema, { ...input, role: 'ADMINISTRATEUR' });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE role = 'ADMINISTRATEUR' FOR UPDATE`;
      const existing = await tx.user.findUnique({ where: { email: data.email } });
      if (input.recover) {
        if (!existing || existing.role !== 'ADMINISTRATEUR' || !existing.isActive) {
          throw new Error('Aucun compte d’administration actif ne correspond à cette adresse.');
        }
        await tx.auditLog.create({
          data: {
            action: 'account.bootstrap_recovery',
            entityType: 'User',
            entityId: existing.id,
          },
        });
        return this.issueLink(
          tx,
          existing.id,
          existing.passwordHash === null ? 'ACTIVATION' : 'REINITIALISATION',
          null,
        );
      }
      const admins = await tx.user.count({ where: { role: 'ADMINISTRATEUR', isActive: true } });
      if (admins > 0) {
        throw new Error(
          'Un compte d’administration actif existe déjà : créez les suivants depuis l’application, ou utilisez --recover.',
        );
      }
      if (existing) throw new Error('Un compte utilise déjà cette adresse e-mail.');
      const user = await tx.user.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'ADMINISTRATEUR',
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'account.bootstrap_created',
          entityType: 'User',
          entityId: user.id,
          metadata: { role: 'ADMINISTRATEUR' },
        },
      });
      return this.issueLink(tx, user.id, 'ACTIVATION', null);
    });
  }
}
