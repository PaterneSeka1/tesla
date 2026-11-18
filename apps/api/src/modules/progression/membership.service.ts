import { Injectable, Logger } from '@nestjs/common';
import { type Actor } from '../../common/actor.js';
import { assertCan } from '../../common/permissions.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ageProgressionOf, loadRuleSetRow, todayCivil, toSnapshot } from './age-rules.js';

export interface MembershipRunReport {
  referenceDate: string;
  ruleSetVersion: string | null;
  examined: number;
  exited: number;
  /** Comptes de routiers sortis passés au rôle ADULTE (D189), sorties antérieures comprises. */
  accountsConverted: number;
  anomalies: string[];
}

/**
 * Appartenance à la branche (RouteMembershipService). Le jour de l'âge de sortie, le routier n'est
 * plus membre actif : le statut est enregistré, l'événement journalisé, l'affectation d'équipe
 * ouverte clôturée à cette date. Rien n'est supprimé (compte, fiche, résultats, études, acquis,
 * étapes, équipes) ; aucune étape (Départ routier compris) n'est attribuée. Le routier sorti est
 * ensuite considéré comme un adulte (D189) : son compte passe au rôle ADULTE, sa fiche reste une
 * fiche routier (matricule, date de naissance et historique conservés). Traitement idempotent ;
 * l'appartenance est aussi recalculée à la lecture (`effectiveMembership`).
 */
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Déclenchement manuel par l'encadrement habilité. */
  async applyExitsAs(actor: Actor): Promise<MembershipRunReport> {
    assertCan(actor, 'membership.apply');
    return this.applyExits(todayCivil(), actor.userId);
  }

  async applyExits(
    referenceDate: string,
    actorId: string | null = null,
  ): Promise<MembershipRunReport> {
    const rules = await loadRuleSetRow(this.prisma, referenceDate);
    const report: MembershipRunReport = {
      referenceDate,
      ruleSetVersion: rules?.version ?? null,
      examined: 0,
      exited: 0,
      accountsConverted: 0,
      anomalies: [],
    };
    if (!rules || rules.branchExitAgeYears === null) {
      report.anomalies.push('Aucun âge de sortie en vigueur : aucune sortie appliquée.');
      report.accountsConverted = await this.convertExitedAccounts(actorId, report);
      return report;
    }
    const snapshot = toSnapshot(rules);
    const candidates = await this.prisma.scoutProfile.findMany({
      where: { kind: 'ROUTIER', membershipStatus: 'ACTIF', birthDate: { not: null } },
      select: { id: true, birthDate: true },
    });
    report.examined = candidates.length;
    for (const profile of candidates) {
      const progression = ageProgressionOf(profile, snapshot, referenceDate);
      if (progression.membership !== 'SORTI' || !progression.branchExitOn) continue;
      const exitOn = new Date(`${progression.branchExitOn}T00:00:00Z`);
      try {
        const applied = await this.prisma.$transaction(async (tx) => {
          const { count } = await tx.scoutProfile.updateMany({
            where: { id: profile.id, membershipStatus: 'ACTIF' },
            data: { membershipStatus: 'SORTI', branchExitedOn: exitOn },
          });
          if (count === 0) return false;
          await tx.routeMembershipEvent.create({
            data: {
              scoutProfileId: profile.id,
              kind: 'SORTIE_AGE',
              effectiveOn: exitOn,
              ruleSetVersion: rules.version,
              recordedById: actorId,
              details: { branchExitAgeYears: rules.branchExitAgeYears },
            },
          });
          // Équipe : l'affectation ouverte est close à la date de sortie (historique conservé).
          const open = await tx.teamAssignment.findFirst({
            where: { scoutProfileId: profile.id, endedAt: null },
          });
          if (open) {
            await tx.teamAssignment.update({
              where: { id: open.id },
              data: { endedAt: open.startedAt < exitOn ? exitOn : new Date(), endedById: actorId },
            });
          }
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'membership.exited',
              entityType: 'ScoutProfile',
              entityId: profile.id,
              metadata: { effectiveOn: progression.branchExitOn, ruleSetVersion: rules.version },
            },
          });
          return true;
        });
        if (applied) report.exited += 1;
      } catch (error) {
        report.anomalies.push(`Profil ${profile.id} : ${(error as Error).message.slice(0, 200)}`);
        this.logger.error(`Sortie non appliquée pour le profil ${profile.id}`);
      }
    }
    report.accountsConverted = await this.convertExitedAccounts(actorId, report);
    this.logger.log(
      `Sorties de branche au ${referenceDate} : ${report.exited} appliquée(s) sur ${report.examined} profil(s) examiné(s), ${report.accountsConverted} compte(s) passé(s) adulte, ${report.anomalies.length} anomalie(s).`,
    );
    return report;
  }

  /**
   * Routier sorti considéré comme adulte (D189) : tout compte ROUTIER rattaché à une fiche sortie
   * passe au rôle ADULTE (cours et évaluations publiés, « Mes résultats »). Idempotent : couvre aussi
   * les sorties antérieures et les comptes rattachés après la sortie. La fiche n'est pas convertie.
   */
  private async convertExitedAccounts(
    actorId: string | null,
    report: MembershipRunReport,
  ): Promise<number> {
    const accounts = await this.prisma.user.findMany({
      where: {
        role: 'ROUTIER',
        scoutProfile: { kind: 'ROUTIER', membershipStatus: 'SORTI' },
      },
      select: { id: true, scoutProfile: { select: { id: true } } },
    });
    let converted = 0;
    for (const account of accounts) {
      try {
        const applied = await this.prisma.$transaction(async (tx) => {
          const { count } = await tx.user.updateMany({
            where: { id: account.id, role: 'ROUTIER' },
            data: { role: 'ADULTE' },
          });
          if (count === 0) return false;
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'membership.account_adult',
              entityType: 'User',
              entityId: account.id,
              metadata: {
                previousRole: 'ROUTIER',
                role: 'ADULTE',
                scoutProfileId: account.scoutProfile?.id ?? null,
              },
            },
          });
          return true;
        });
        if (applied) converted += 1;
      } catch (error) {
        report.anomalies.push(`Compte ${account.id} : ${(error as Error).message.slice(0, 200)}`);
        this.logger.error(`Compte non passé adulte : ${account.id}`);
      }
    }
    return converted;
  }
}
