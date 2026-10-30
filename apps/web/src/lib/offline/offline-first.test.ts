import { describe, expect, it } from 'vitest';
import { type SessionUser } from '@tesla/shared';
import { ApiError } from '@/lib/api/client';
import { classifyFailure, type LocalOperation, OPERATION_TYPES, substituteIds } from './operations';
import { cacheKey, isCacheablePath } from './repository';
import { identityAt } from './vault';

const user: SessionUser = {
  id: '0190f0c0-0000-7000-8000-000000000001',
  email: 'chef@exemple.test',
  firstName: 'Chef',
  lastName: 'Fictif',
  role: 'ENCADREMENT',
  scoutProfileId: null,
  leaderFunction: 'PLEIN',
  permissions: ['scout.read', 'scout.update', 'attendance.record'],
};

describe('dépôt local', () => {
  it('normalise l’ordre des paramètres de requête', () => {
    expect(cacheKey('/scouts?page=1&status=active&pageSize=20')).toBe(
      cacheKey('/scouts?status=active&pageSize=20&page=1'),
    );
    expect(cacheKey('/me/dashboard')).toBe('q:/me/dashboard');
  });

  it('ne conserve jamais session, réservations, corrigés ni corrections', () => {
    for (const path of [
      '/auth/me',
      '/offline/attempts/x/status',
      '/attempts/x/answers',
      '/editor/evaluations/x',
      '/admin/evaluations/x/review',
      '/admin/attempts/x',
      '/corrections/NT-2026-000001',
      '/auth/sessions',
      '/users?page=1',
    ])
      expect(isCacheablePath(path)).toBe(false);
    expect(isCacheablePath('/scouts/x')).toBe(true);
    expect(isCacheablePath('/modules/m/lessons/l')).toBe(true);
  });
});

describe('identité locale (D112)', () => {
  const verifiedAt = '2026-10-30T08:00:00.000Z';

  it('reste utilisable pendant la durée de validité locale', () => {
    expect(identityAt({ user, verifiedAt }, new Date('2026-11-05T08:00:00Z'))).toEqual(user);
  });

  it('expire au-delà de 14 jours sans vérification serveur', () => {
    expect(identityAt({ user, verifiedAt }, new Date('2026-11-14T09:00:00Z'))).toBeNull();
  });

  it('refuse une horloge antérieure à la vérification', () => {
    expect(identityAt({ user, verifiedAt }, new Date('2026-10-29T08:00:00Z'))).toBeNull();
  });

  it('un refus de droits au retour du réseau rejette l’opération sans la supprimer (D133)', () => {
    expect(classifyFailure(new ApiError(403, 'FORBIDDEN', 'Refusé'))).toEqual({
      status: 'REJETE',
      transient: false,
      stop: false,
    });
  });
});

describe('file de synchronisation (D110)', () => {
  it('remplace les identifiants provisoires dans le chemin et le corps', () => {
    const temp = '11111111-1111-4111-8111-111111111111';
    const real = '0190f0c0-0000-7000-8000-00000000abcd';
    expect(
      substituteIds({ path: `/scouts/${temp}/teams/assign`, body: { a: temp } }, { [temp]: real }),
    ).toEqual({ path: `/scouts/${real}/teams/assign`, body: { a: real } });
  });

  it('classe les échecs : réseau et 5xx différés, 409 en conflit, autres 4xx rejetés', () => {
    expect(classifyFailure(new ApiError(0, 'NETWORK_ERROR', ''))).toMatchObject({
      status: 'EN_ATTENTE',
      stop: true,
    });
    expect(classifyFailure(new ApiError(503, 'X', '')).status).toBe('EN_ATTENTE');
    expect(classifyFailure(new ApiError(409, 'OPERATION_IN_PROGRESS', '')).status).toBe(
      'EN_ATTENTE',
    );
    expect(classifyFailure(new ApiError(409, 'ATTENDANCE_CHANGED', '')).status).toBe('CONFLIT');
    expect(classifyFailure(new ApiError(403, 'FORBIDDEN', '')).status).toBe('REJETE');
    expect(classifyFailure(new ApiError(401, 'UNAUTHENTICATED', '')).status).toBe('EN_ATTENTE');
  });

  it('fusionne deux saisies de présence en conservant le statut de référence initial', () => {
    const merged = OPERATION_TYPES['attendance.save'].merge!(
      { entries: [{ scoutProfileId: 'a', status: 'PRESENT', expectedStatus: 'NON_RENSEIGNE' }] },
      {
        entries: [
          { scoutProfileId: 'a', status: 'ABSENT', expectedStatus: 'PRESENT' },
          { scoutProfileId: 'b', status: 'EXCUSE', expectedStatus: 'NON_RENSEIGNE' },
        ],
      },
    );
    expect(merged.entries).toEqual([
      { scoutProfileId: 'a', status: 'ABSENT', expectedStatus: 'NON_RENSEIGNE' },
      { scoutProfileId: 'b', status: 'EXCUSE', expectedStatus: 'NON_RENSEIGNE' },
    ]);
  });

  it('conserve la révision de référence lors d’une fusion puis la met à jour après confirmation', () => {
    const definition = OPERATION_TYPES['activity.update'];
    expect(definition.merge!({ revision: 3, title: 'A' }, { revision: 3, report: 'R' })).toEqual({
      revision: 3,
      title: 'A',
      report: 'R',
    });
    expect(definition.rebase!({ revision: 3, title: 'B' }, { revision: 4 })).toEqual({
      revision: 4,
      title: 'B',
    });
  });

  it('affiche provisoirement les présences saisies dans la copie locale', () => {
    const op = {
      entity: { kind: 'activity', id: 'act' },
      body: { entries: [{ scoutProfileId: 's1', status: 'PRESENT' }] },
    } as LocalOperation;
    const [overlay] = OPERATION_TYPES['attendance.save'].overlay!(op);
    expect(overlay!.path).toBe('/activities/act/attendance');
    expect(
      overlay!.update({
        entries: [
          { scout: { id: 's1' }, status: 'NON_RENSEIGNE', note: null },
          { scout: { id: 's2' }, status: 'ABSENT', note: null },
        ],
      }),
    ).toEqual({
      entries: [
        { scout: { id: 's1' }, status: 'PRESENT', note: null },
        { scout: { id: 's2' }, status: 'ABSENT', note: null },
      ],
    });
  });

  it('ne réserve aucune opération différable aux décisions officielles', () => {
    const permissions = Object.values(OPERATION_TYPES).map((d) => d.permission);
    for (const official of [
      'scout.setStage',
      'competency.decide',
      'leadership.manage',
      'attempt.decide',
      'module.publish',
    ])
      expect(permissions).not.toContain(official);
  });
});
