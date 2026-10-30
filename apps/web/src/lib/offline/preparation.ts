import { type QueryClient } from '@tanstack/react-query';
import { type SessionUser } from '@tesla/shared';
import { ApiError } from '@/lib/api/client';
import {
  chefDashboardQueryOptions,
  myActivitiesQueryOptions,
  myDashboardQueryOptions,
  responsableDashboardQueryOptions,
} from '@/lib/api/dashboards';
import {
  availableEvaluationQueryOptions,
  availableEvaluationsQueryOptions,
  myAttemptsQueryOptions,
} from '@/lib/api/evaluations';
import { leadershipOverviewQueryOptions, mandateHistoryQueryOptions } from '@/lib/api/leadership';
import {
  catalogLessonQueryOptions,
  catalogModuleQueryOptions,
  catalogQueryOptions,
} from '@/lib/api/modules';
import {
  ageRuleSetsQueryOptions,
  myPathwayQueryOptions,
  pathwayOverviewQueryOptions,
  scoutPathwayQueryOptions,
} from '@/lib/api/pathway';
import {
  activitiesQueryOptions,
  activityQueryOptions,
  attendanceQueryOptions,
  programmeCategoriesQueryOptions,
  programmesQueryOptions,
} from '@/lib/api/programmes';
import {
  competenciesQueryOptions,
  myProgressionQueryOptions,
  publishedModulesQueryOptions,
  scoutProgressionQueryOptions,
  scoutTimelineQueryOptions,
} from '@/lib/api/progression';
import {
  observationsQueryOptions,
  scoutQueryOptions,
  scoutsQueryOptions,
  stagesQueryOptions,
  teamHistoryQueryOptions,
} from '@/lib/api/scouts';
import { activeTeamsQueryOptions, teamQueryOptions, teamsQueryOptions } from '@/lib/api/teams';
import { navigationFor, userCan } from '@/lib/navigation';
import { ownerId, putRecord, readRecord } from './vault';

// Préparation de l'appareil (D115) : en ligne, télécharge les données autorisées du compte (via
// les mêmes requêtes que les écrans, donc conservées dans le coffre) puis les pages de
// l'application (service worker). « Prêt » n'est affiché que si tout l'indispensable est présent.

export interface PreparationReport {
  preparedAt: string;
  userId: string;
  /** Données et pages indispensables présentes. */
  ready: boolean;
  dataFailures: string[];
  missingPages: string[];
  pages: number;
  requests: number;
}

type Options = { queryKey: readonly unknown[]; queryFn?: unknown };
type Progress = (message: string) => void;

/** Ressource collective : un refus (403) signifie « hors périmètre », pas un échec. */
async function fetchData<T>(
  client: QueryClient,
  options: Options & { queryFn?: unknown },
  label: string,
  failures: string[],
): Promise<T | null> {
  try {
    return (await client.fetchQuery({ ...(options as object), staleTime: 0 } as never)) as T;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
    failures.push(label);
    return null;
  }
}

/** Toutes les pages d'une liste paginée (la première page est aussi celle des écrans). */
async function allPages<T extends { id: string }>(
  client: QueryClient,
  page: (n: number) => Options,
  label: string,
  failures: string[],
): Promise<T[]> {
  const items: T[] = [];
  for (let n = 1; n <= 20; n++) {
    const data = await fetchData<{ items: T[]; total: number; pageSize: number }>(
      client,
      page(n),
      label,
      failures,
    );
    if (!data) break;
    items.push(...data.items);
    if (n * data.pageSize >= data.total) break;
  }
  return items;
}

function postToWorker<T>(message: unknown, onMessage?: (data: { type: string }) => void) {
  return new Promise<T>((resolve, reject) => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) {
      reject(new Error('Application non installée sur cet appareil (service worker inactif).'));
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<{ type: string }>) => {
      onMessage?.(event.data);
      if (event.data.type !== 'progress') resolve(event.data as T);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Pages encore absentes du cache de l'application (vide : toutes présentes). */
export async function missingPages(paths: string[]): Promise<string[]> {
  try {
    return (await postToWorker<{ missing: string[] }>({ type: 'PAGES_STATUS', paths })).missing;
  } catch {
    return paths;
  }
}

export async function prepareDevice(
  client: QueryClient,
  user: SessionUser,
  progress: Progress,
): Promise<PreparationReport> {
  if (ownerId() !== user.id) throw new Error('Déverrouillez d’abord cet appareil.');
  if (!navigator.onLine) throw new Error('La préparation nécessite une connexion.');
  const failures: string[] = [];
  const pages = new Set<string>(
    navigationFor(user).flatMap((group) => group.items.map((item) => item.href)),
  );
  pages.add('/appareil');
  let requests = 0;
  const get = <T>(options: Options, label: string) => {
    requests++;
    return fetchData<T>(client, options, label, failures);
  };

  progress('Référentiels…');
  await get(stagesQueryOptions, 'Étapes');

  if (user.role !== 'ADMINISTRATEUR') {
    progress('Bibliothèque des modules…');
    await get(publishedModulesQueryOptions, 'Modules publiés');
    const modules = await allPages<{ id: string; slug: string }>(
      client,
      (page) => catalogQueryOptions({ search: '', page, pageSize: 12 }),
      'Bibliothèque',
      failures,
    );
    for (const [index, item] of modules.entries()) {
      progress(`Module ${index + 1}/${modules.length}…`);
      const detail = await get<{ lessons: { id: string }[] }>(
        catalogModuleQueryOptions(item.slug),
        `Module ${item.slug}`,
      );
      pages.add(`/modules/${item.slug}`);
      for (const lesson of detail?.lessons ?? []) {
        await get(catalogLessonQueryOptions(item.slug, lesson.id), `Leçon de ${item.slug}`);
        pages.add(`/modules/${item.slug}/lecons/${lesson.id}`);
      }
    }
  }

  if (user.role === 'ROUTIER') {
    progress('Parcours personnel…');
    await get(myDashboardQueryOptions, 'Tableau de bord');
    await get(myPathwayQueryOptions, 'Parcours');
    await get(myProgressionQueryOptions, 'Progression');
    await get(myActivitiesQueryOptions, 'Activités');
    await get(myAttemptsQueryOptions({ page: 1, pageSize: 10 }), 'Résultats');
    const evaluations = await allPages<{ id: string }>(
      client,
      (page) => availableEvaluationsQueryOptions({ search: '', page, pageSize: 12 }),
      'Évaluations',
      failures,
    );
    for (const evaluation of evaluations) {
      await get(availableEvaluationQueryOptions(evaluation.id), 'Évaluation');
      await get(
        myAttemptsQueryOptions({ evaluationId: evaluation.id, pageSize: 20 }),
        'Tentatives',
      );
      pages.add(`/evaluations/${evaluation.id}`);
      pages.add(`/evaluations/${evaluation.id}/passer`);
    }
  }

  if (user.role === 'ENCADREMENT') {
    progress('Tableau de bord…');
    await get(
      userCan(user, 'dashboard.official')
        ? responsableDashboardQueryOptions
        : chefDashboardQueryOptions,
      'Tableau de bord',
    );
    await get(pathwayOverviewQueryOptions(), 'Parcours');
    await get(ageRuleSetsQueryOptions, 'Référentiel d’âge');

    progress('Équipes…');
    await get(activeTeamsQueryOptions, 'Équipes actives');
    await get(teamsQueryOptions({ pageSize: 100 }), 'Équipes');
    const teams = await allPages<{ id: string }>(
      client,
      (page) => teamsQueryOptions({ search: '', status: 'active', page, pageSize: 20 }),
      'Équipes',
      failures,
    );
    for (const team of teams) {
      await get(teamQueryOptions(team.id), 'Équipe');
      pages.add(`/administration/equipes/${team.id}`);
    }

    const scouts = await allPages<{ id: string }>(
      client,
      (page) =>
        scoutsQueryOptions({ search: '', status: 'active', account: 'all', page, pageSize: 20 }),
      'Routiers',
      failures,
    );
    for (const [index, scout] of scouts.entries()) {
      progress(`Fiche ${index + 1}/${scouts.length}…`);
      await get(scoutQueryOptions(scout.id), 'Fiche routier');
      await get(teamHistoryQueryOptions(scout.id), 'Historique d’équipe');
      await get(observationsQueryOptions(scout.id, 1), 'Observations');
      await get(scoutPathwayQueryOptions(scout.id), 'Parcours du routier');
      await get(scoutProgressionQueryOptions(scout.id), 'Progression du routier');
      await get(scoutTimelineQueryOptions(scout.id), 'Dossier pédagogique');
      pages.add(`/administration/routiers/${scout.id}`);
    }

    progress('Activités et présences…');
    await get(programmesQueryOptions, 'Programme annuel');
    await get(programmeCategoriesQueryOptions, 'Catégories');
    await get(competenciesQueryOptions({ status: 'active', pageSize: 100 }), 'Compétences');
    await get(
      competenciesQueryOptions({ status: 'active', search: '', page: 1, pageSize: 20 }),
      'Compétences',
    );
    await get(
      activitiesQueryOptions({ search: '', page: 1, pageSize: 20, attendanceMissing: 'true' }),
      'Présences à saisir',
    );
    const activities = await allPages<{ id: string }>(
      client,
      (page) => activitiesQueryOptions({ search: '', page, pageSize: 20 }),
      'Activités',
      failures,
    );
    for (const activity of activities) {
      await get(activityQueryOptions(activity.id), 'Activité');
      await get(attendanceQueryOptions(activity.id), 'Feuille de présence');
      pages.add(`/administration/activites/${activity.id}`);
    }
  }

  if (userCan(user, 'mandate.read')) {
    progress('Responsables et mandats…');
    await get(leadershipOverviewQueryOptions, 'Responsables');
    await get(mandateHistoryQueryOptions(), 'Mandats');
  }

  progress(`Pages de l’application (${pages.size})…`);
  const paths = [...pages];
  const result = await postToWorker<{ failed: string[] }>(
    { type: 'PREPARE_PAGES', paths },
    (data) => {
      const p = data as unknown as { type: string; done: number; total: number };
      if (p.type === 'progress') progress(`Pages de l’application ${p.done}/${p.total}…`);
    },
  ).catch((error: unknown) => ({
    failed: paths,
    error: error instanceof Error ? error.message : '',
  }));
  navigator.serviceWorker?.controller?.postMessage({ type: 'PRUNE_STATIC' });
  const missing = result.failed.length > 0 ? result.failed : await missingPages(paths);
  const report: PreparationReport = {
    preparedAt: new Date().toISOString(),
    userId: user.id,
    ready: failures.length === 0 && missing.length === 0,
    dataFailures: [...new Set(failures)],
    missingPages: missing,
    pages: paths.length,
    requests,
  };
  await putRecord('meta:preparation', report);
  await putRecord('meta:preparation-pages', paths);
  return report;
}

export async function lastPreparation(): Promise<PreparationReport | null> {
  if (!ownerId()) return null;
  return (await readRecord<PreparationReport>('meta:preparation').catch(() => null))?.value ?? null;
}

/** Revérifie, sans réseau, que les pages préparées sont toujours présentes (éviction possible). */
export async function verifyPreparedPages(): Promise<string[] | null> {
  if (!ownerId()) return null;
  const paths = (await readRecord<string[]>('meta:preparation-pages').catch(() => null))?.value;
  return paths ? missingPages(paths) : null;
}
