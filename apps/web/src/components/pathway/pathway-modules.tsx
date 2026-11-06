'use client';

import { type ScoutPathway } from '@tesla/shared';
import { BookOpen, CheckCircle2, Lock, Undo2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCivilDate } from './pathway-summary';

/** Rattrapage en cours (D177) : étape, échéance ; les autres cours restent fermés. */
export function CatchUpLockNotice({ pathway }: { pathway: ScoutPathway }) {
  const lock = pathway.catchUpLock;
  if (!lock.active) return null;
  return (
    <Alert variant="info">
      <Lock aria-hidden />
      <AlertDescription>
        Rattrapage en cours{lock.stage ? ` : ${lock.stage.name}` : ''}
        {lock.dueOn ? `, à terminer avant le ${formatCivilDate(lock.dueOn)}` : ''}. Les autres cours
        restent fermés jusque-là.
      </AlertDescription>
    </Alert>
  );
}

/**
 * Trois catégories distinctes (D173) : modules de l'étape actuelle (calculée selon l'âge), modules à
 * rattraper (obligations sans décision encore exigées), modules reconnus acquis (décision humaine).
 * Un module n'apparaît jamais dans deux catégories.
 */
export function PathwayModules({
  pathway,
  compact = false,
}: {
  pathway: ScoutPathway;
  /** Accueil : rattrapages et acquis non vides seulement (l'étape a son propre bloc « À étudier »). */
  compact?: boolean;
}) {
  const acquired = pathway.catchUps.filter((obligation) => obligation.decision === 'ACQUIS');
  const toCatchUp = pathway.catchUps.filter(
    (obligation) => obligation.decision === null && obligation.stillRequired,
  );
  const elsewhere = new Set([...acquired, ...toCatchUp].map((obligation) => obligation.module.id));
  const current = pathway.stageModules.filter((module) => !elsewhere.has(module.id));
  const lock = pathway.catchUpLock;
  const later = (moduleId: string) => lock.active && !lock.allowedModuleIds.includes(moduleId);
  const catchUpBadge = (obligation: (typeof toCatchUp)[number]) =>
    later(obligation.module.id)
      ? `${obligation.originStage.name} · ensuite`
      : obligation.originStage.name;
  if (compact) {
    if (toCatchUp.length === 0 && acquired.length === 0) return null;
    return (
      <div className="space-y-3">
        <CatchUpLockNotice pathway={pathway} />
        <div className="grid gap-3 md:grid-cols-2">
          {toCatchUp.length > 0 && (
            <ModuleGroup
              icon={Undo2}
              title="Modules à rattraper"
              empty=""
              items={toCatchUp.map((obligation) => ({
                id: obligation.id,
                label: `${obligation.module.code} · ${obligation.module.title}`,
                badge: catchUpBadge(obligation),
              }))}
            />
          )}
          {acquired.length > 0 && (
            <ModuleGroup
              icon={CheckCircle2}
              title="Modules déjà acquis"
              empty=""
              items={acquired.map((obligation) => ({
                id: obligation.id,
                label: `${obligation.module.code} · ${obligation.module.title}`,
                badge: null,
              }))}
            />
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <CatchUpLockNotice pathway={pathway} />
      <div className="grid gap-3 md:grid-cols-3">
        <ModuleGroup
          icon={BookOpen}
          title="Modules de mon étape"
          empty={pathway.stage ? 'Aucun module publié pour cette étape.' : 'Étape non déterminée.'}
          items={current.map((module) => ({
            id: module.id,
            label: `${module.code} · ${module.title}`,
            badge: module.locked
              ? 'Fermé'
              : module.studied
                ? 'Étudié'
                : module.obligation === 'OBLIGATOIRE'
                  ? 'Obligatoire'
                  : null,
          }))}
        />
        <ModuleGroup
          icon={Undo2}
          title="Modules à rattraper"
          empty="Aucun module à rattraper."
          items={toCatchUp.map((obligation) => ({
            id: obligation.id,
            label: `${obligation.module.code} · ${obligation.module.title}`,
            badge: catchUpBadge(obligation),
          }))}
        />
        <ModuleGroup
          icon={CheckCircle2}
          title="Modules déjà acquis"
          empty="Aucun module reconnu acquis."
          items={acquired.map((obligation) => ({
            id: obligation.id,
            label: `${obligation.module.code} · ${obligation.module.title}`,
            badge: null,
          }))}
        />
      </div>
    </div>
  );
}

function ModuleGroup({
  icon: Icon,
  title,
  empty,
  items,
}: {
  icon: typeof BookOpen;
  title: string;
  empty: string;
  items: { id: string; label: string; badge: string | null }[];
}) {
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3" aria-label={title}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-tesla-bordeaux" aria-hidden />
        {title}
        <span className="text-muted-foreground">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">{item.label}</span>
              {item.badge && <Badge variant="outline">{item.badge}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
