import { createHash, randomInt } from 'node:crypto';
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
  type AccountTokenPurpose,
  type AccountWithLink,
  ACTIVATION_CODE_ALPHABET,
  ACTIVATION_CODE_LENGTH,
  accountCredentialSchema,
  completeAccountCredentialInputSchema,
  createAccountInputSchema,
  deactivateAccountInputSchema,
  type Paginated,
  passwordResetRequestInputSchema,
  type PasswordResetRequestResult,
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
import { CODE_MAX_FAILURES, LoginRateLimiter } from '../auth/login-rate-limiter.js';
import { hashPassword } from '../auth/password.js';
import { generateSessionToken, hashSessionToken } from '../auth/session-token.js';
import { AccountMailer } from './account-mailer.js';

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

// Même message que l'e-mail soit connu ou non (aucune énumération des comptes).
const invalidCode = () =>
  new BadRequestException({
    code: 'INVALID_ACCOUNT_CODE',
    message:
      'Adresse e-mail ou code incorrect, expiré ou déjà utilisé. Vérifiez votre saisie ou demandez un nouveau code.',
  });

/** Code de secours (D162) : tirage cryptographique uniforme dans l'alphabet de Crockford. */
export function generateActivationCode(): string {
  let code = '';
  for (let index = 0; index < ACTIVATION_CODE_LENGTH; index += 1) {
    code += ACTIVATION_CODE_ALPHABET[randomInt(ACTIVATION_CODE_ALPHABET.length)];
  }
  return code;
}

/** Empreinte du code liée à l'e-mail : seul le couple (e-mail, code) ouvre l'invitation. */
export function hashActivationCode(email: string, code: string): string {
  return createHash('sha256').update(`account-code\u0000${email}\u0000${code}`).digest('hex');
}

const formatCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;

type ParsedCredential = { token: string } | { email: string; code: string };

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
    private readonly mailer: AccountMailer,
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
      const created = await this.prisma.$transaction(async (tx) => {
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
      const sentByEmail = await this.mailLink(created.account, created.link);
      return { ...created, link: { ...created.link, sentByEmail } };
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
    await this.limiter.consume(this.limiter.userKeys('reissue', id));
    const issued = await this.prisma.$transaction(async (tx) => {
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
    const sentByEmail = await this.mailLink(issued.account, issued.link);
    return { ...issued, link: { ...issued.link, sentByEmail } };
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

  /**
   * Jeton à usage unique et code de secours équivalent (D162) ; seules leurs empreintes sont
   * conservées. Révoque les liens précédents du compte. Durée : `ttlMs`, ou la durée des liens
   * transmis par une personne habilitée (ACCOUNT_LINK_TTL_HOURS).
   */
  private async issueLink(
    tx: Tx,
    userId: string,
    purpose: AccountTokenPurpose,
    createdById: string | null,
    ttlMs = this.env.ACCOUNT_LINK_TTL_HOURS * 3_600_000,
  ): Promise<AccountLink> {
    const now = new Date();
    await tx.accountToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const { email } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const token = generateSessionToken();
    const code = generateActivationCode();
    const expiresAt = new Date(now.getTime() + ttlMs);
    await tx.accountToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashSessionToken(token),
        codeHash: hashActivationCode(email, code),
        expiresAt,
        createdById,
      },
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
    return {
      token,
      code: formatCode(code),
      purpose,
      expiresAt: expiresAt.toISOString(),
      sentByEmail: false,
    };
  }

  /**
   * Envoi par e-mail d'un lien émis par une personne habilitée, si SMTP est configuré. Le lien reste
   * affiché une fois à l'émetteur dans tous les cas (récupération administrée).
   */
  private async mailLink(account: Account, link: AccountLink): Promise<boolean> {
    if (!this.mailer.enabled) return false;
    return this.mailer.sendAccountLink({
      to: account.email,
      firstName: account.firstName,
      purpose: link.purpose,
      token: link.token,
      code: link.code.replace('-', ''),
      expiresAt: new Date(link.expiresAt),
    });
  }

  private async findUsable(where: { tokenHash: string } | { codeHash: string }) {
    const row = await this.prisma.accountToken.findUnique({
      where,
      include: { user: { select: { firstName: true, isActive: true } } },
    });
    if (!row || row.usedAt || row.revokedAt || row.expiresAt <= new Date() || !row.user.isActive) {
      return null;
    }
    return row;
  }

  /**
   * Contrôle commun du lien et du code (D162), pour une finalité donnée (`null` : anciennes routes
   * `/auth/account-link`, la finalité du jeton fait foi). Un jeton d'activation n'ouvre jamais la
   * récupération, et inversement. Échecs comptés par adresse IP (et par e-mail pour un code) ; un
   * code erroné compte aussi sur l'invitation en cours, révoquée au 5e essai.
   */
  private async resolveCredential(
    credential: ParsedCredential,
    purpose: AccountTokenPurpose | null,
    ip: string,
  ) {
    const byToken = 'token' in credential;
    const keys = byToken ? this.limiter.tokenKeys(ip) : this.limiter.codeKeys(ip, credential.email);
    await this.limiter.assertAllowed(keys);
    const row = await this.findUsable(
      byToken
        ? { tokenHash: hashSessionToken(credential.token) }
        : { codeHash: hashActivationCode(credential.email, credential.code) },
    );
    if (row && (purpose === null || row.purpose === purpose)) return row;
    await this.limiter.recordFailure(keys);
    if (byToken) throw invalidLink();
    const pending = {
      user: { email: credential.email },
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(purpose && { purpose }),
    } satisfies Prisma.AccountTokenWhereInput;
    await this.prisma.accountToken.updateMany({
      where: pending,
      data: { codeFailures: { increment: 1 } },
    });
    const revoked = await this.prisma.accountToken.updateMany({
      where: { ...pending, codeFailures: { gte: CODE_MAX_FAILURES } },
      data: { revokedAt: new Date() },
    });
    if (revoked.count > 0) {
      const user = await this.prisma.user.findUnique({
        where: { email: credential.email },
        select: { id: true },
      });
      await this.prisma.auditLog.create({
        data: {
          action: 'account.code_locked',
          entityType: 'User',
          entityId: user?.id ?? null,
          metadata: { purpose },
        },
      });
    }
    throw invalidCode();
  }

  /** Vérification préalable d'un lien ou d'un code (route publique) : ne consomme rien. */
  async verifyCredential(
    input: unknown,
    ip: string,
    purpose: AccountTokenPurpose | null,
  ): Promise<AccountTokenInfo> {
    const credential: ParsedCredential = parseInput(accountCredentialSchema, input);
    const row = await this.resolveCredential(credential, purpose, ip);
    return {
      purpose: row.purpose,
      firstName: row.user.firstName,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /** Ancienne route `/auth/account-link/inspect` (liens `/activation#…` déjà émis). */
  async inspectToken(input: unknown, ip: string): Promise<AccountTokenInfo> {
    return this.verifyCredential(input, ip, null);
  }

  /** Ancienne route `/auth/account-link/complete`. */
  async completeToken(input: unknown, ip: string): Promise<void> {
    return this.completeCredential(input, ip, null);
  }

  /**
   * Définit le mot de passe choisi par le titulaire. La preuve (lien ou code) est revérifiée puis
   * consommée par une mise à jour conditionnelle (deux envois simultanés : un seul réussit) ;
   * toutes les sessions existantes sont révoquées. Un compte désactivé n'est jamais réactivé.
   */
  async completeCredential(
    input: unknown,
    ip: string,
    purpose: AccountTokenPurpose | null,
  ): Promise<void> {
    const parsed = parseInput(completeAccountCredentialInputSchema, input);
    const { password } = parsed;
    const credential: ParsedCredential =
      'token' in parsed ? { token: parsed.token } : { email: parsed.email, code: parsed.code };
    const row = await this.resolveCredential(credential, purpose, ip);
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.accountToken.updateMany({
        where: { id: row.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (count === 0) throw 'token' in credential ? invalidLink() : invalidCode();
      const user = await tx.user.updateMany({
        where: { id: row.userId, isActive: true },
        data: { passwordHash },
      });
      if (user.count === 0) throw invalidLink();
      const sessions = await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: row.userId,
          action: row.purpose === 'ACTIVATION' ? 'account.activated' : 'account.password_reset',
          entityType: 'User',
          entityId: row.userId,
          metadata: {
            method: 'token' in credential ? 'lien' : 'code',
            revokedSessions: sessions.count,
          },
        },
      });
    });
  }

  /**
   * « Mot de passe oublié » en libre-service (D166). Réponse identique que le compte existe ou non,
   * et au même rythme (l'envoi n'est pas attendu). Sans SMTP, rien n'est émis : la personne
   * s'adresse à un responsable habilité (récupération administrée). Compte désactivé ou jamais
   * activé : aucune émission.
   */
  async requestPasswordReset(input: unknown, ip: string): Promise<PasswordResetRequestResult> {
    const { email } = parseInput(passwordResetRequestInputSchema, input);
    await this.limiter.consume(this.limiter.resetRequestKeys(ip, email));
    if (!this.mailer.enabled) return { channel: 'RESPONSABLE' };
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, isActive: true, passwordHash: true },
    });
    if (user?.isActive && user.passwordHash !== null) {
      const link = await this.prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'account.password_reset_requested',
            entityType: 'User',
            entityId: user.id,
          },
        });
        return this.issueLink(
          tx,
          user.id,
          'REINITIALISATION',
          null,
          this.env.PASSWORD_RESET_TTL_MINUTES * 60_000,
        );
      });
      void this.mailer.sendAccountLink({
        to: user.email,
        firstName: user.firstName,
        purpose: 'REINITIALISATION',
        token: link.token,
        code: link.code.replace('-', ''),
        expiresAt: new Date(link.expiresAt),
      });
    }
    return { channel: 'EMAIL' };
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
