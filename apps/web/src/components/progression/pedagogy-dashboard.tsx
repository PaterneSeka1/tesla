'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FOLLOW_UP_REASON_LABELS, type FollowUpItem, type ActivitySummary } from '@tesla/shared';
import {
  chefDashboardQueryOptions,
  responsableDashboardQueryOptions,
  myDashboardQueryOptions,
} from '@/lib/api/dashboards';

function Metric({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="rounded border bg-card p-4 hover:border-primary">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Link>
  );
}
function Upcoming({ items }: { items: ActivitySummary[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">Prochaines activités</h2>
      {items.length === 0 && <p>Aucune activité planifiée.</p>}
      {items.map((a) => (
        <p key={a.id}>
          {a.plannedOn} · {a.title}
        </p>
      ))}
    </section>
  );
}
function FollowUp({ items }: { items: FollowUpItem[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">Accompagnement</h2>
      <p>Faits à examiner par l’encadrement ; aucune sanction ni décision automatique.</p>
      {items.length === 0 && <p>Aucun signal enregistré.</p>}
      {items.map((item) => (
        <div key={item.scout.id} className="rounded border p-3">
          <Link className="underline" href={`/administration/routiers/${item.scout.id}`}>
            {item.scout.firstName} {item.scout.lastName}
          </Link>
          <p>{item.reasons.map((r) => FOLLOW_UP_REASON_LABELS[r]).join(' · ')}</p>
        </div>
      ))}
    </section>
  );
}
export function ResponsablePedagogyDashboard() {
  const query = useQuery(responsableDashboardQueryOptions);
  if (query.isPending) return <p role="status">Chargement des indicateurs…</p>;
  if (!query.data)
    return (
      <p role="alert">
        Indicateurs indisponibles.{' '}
        <button className="underline" onClick={() => void query.refetch()}>
          Réessayer
        </button>
      </p>
    );
  const d = query.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Routiers actifs"
          value={d.statistics.scouts.active}
          href="/administration/routiers"
        />
        <Metric
          label="Sans compte"
          value={d.statistics.scouts.withoutAccount}
          href="/administration/routiers?account=without"
        />
        <Metric
          label="Compétences validées"
          value={d.statistics.competencies.acquired}
          href="/administration/validations"
        />
        <Metric
          label="Activités réalisées"
          value={d.statistics.activities.realised}
          href="/administration/activites"
        />
      </div>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contenus à approuver</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            label="Modules"
            value={d.contentQueue.modulesToApprove}
            href="/administration/modules-a-valider"
          />
          <Metric
            label="Questionnaires"
            value={d.contentQueue.evaluationsToApprove}
            href="/administration/evaluations"
          />
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Décisions pédagogiques sur les personnes</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Propositions de compétences"
            value={d.pedagogyQueue.proposalsPending}
            href="/administration/validations"
          />
          <Metric
            label="Compléments demandés"
            value={d.pedagogyQueue.complementRequested}
            href="/administration/validations"
          />
          <Metric
            label="Résultats à examiner"
            value={d.pedagogyQueue.resultsToReview}
            href="/administration/evaluations-a-valider"
          />
          <Metric
            label="Copies à corriger"
            value={d.pedagogyQueue.correctionsInProgress}
            href="/chef/corrections"
          />
        </div>
      </section>
      <Upcoming items={d.upcomingActivities} />
      <FollowUp items={d.followUp} />
      <Link className="underline" href="/administration/statistiques">
        Statistiques par équipe et par étape
      </Link>
    </div>
  );
}
export function ChefPedagogyDashboard() {
  const query = useQuery(chefDashboardQueryOptions);
  if (query.isPending) return <p role="status">Chargement du suivi…</p>;
  if (!query.data)
    return (
      <p role="alert">
        Suivi indisponible.{' '}
        <button className="underline" onClick={() => void query.refetch()}>
          Réessayer
        </button>
      </p>
    );
  const d = query.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Routiers suivis" value={d.activeScouts} href="/administration/routiers" />
        <Metric
          label="Mes propositions en attente"
          value={d.myProposals.pending}
          href="/administration/validations"
        />
        <Metric
          label="Compléments demandés"
          value={d.myProposals.complementRequested}
          href="/administration/validations"
        />
        <Metric label="Copies à corriger" value={d.correctionsToDo} href="/chef/corrections" />
        <Metric label="Modules en préparation" value={d.modulesInProgress} href="/chef/modules" />
        <Metric
          label="Présences à renseigner"
          value={d.attendanceToRecord.length}
          href="/administration/presences"
        />
      </div>
      <Upcoming items={d.upcomingActivities} />
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Mes observations récentes</h2>
        {d.recentObservations.length === 0 && <p>Aucune observation.</p>}
        {d.recentObservations.map((o) => (
          <p key={o.id}>
            <Link className="underline" href={`/administration/routiers/${o.scout.id}`}>
              {o.scout.firstName} {o.scout.lastName}
            </Link>{' '}
            · {o.observedOn} · {o.excerpt}
          </p>
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Réponses à mes propositions</h2>
        {d.myProposals.recentlyDecided.length === 0 && <p>Aucune décision récente.</p>}
        {d.myProposals.recentlyDecided.map((p) => (
          <p key={p.id}>
            <Link className="underline" href={`/administration/validations/${p.id}`}>
              {p.competency.name} · {p.scout.firstName} {p.scout.lastName}
            </Link>{' '}
            · {p.status === 'APPROUVEE' ? 'Approuvée' : 'Refusée'}
          </p>
        ))}
      </section>
      <FollowUp items={d.followUp} />
    </div>
  );
}
export function RoutierPedagogyDashboard() {
  const query = useQuery(myDashboardQueryOptions);
  if (query.isPending) return <p role="status">Chargement du parcours…</p>;
  if (!query.data)
    return (
      <p role="alert">
        Parcours indisponible.{' '}
        <button className="underline" onClick={() => void query.refetch()}>
          Réessayer
        </button>
      </p>
    );
  const d = query.data;
  if (!d.linked)
    return (
      <p>Votre compte n’est pas encore rattaché à un profil routier. Contactez le responsable.</p>
    );
  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">
        {d.stage?.name ?? 'Étape non renseignée'} {d.stageSince && `depuis le ${d.stageSince}`} ·{' '}
        {d.team?.name ?? 'Sans équipe'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Modules étudiés" value={d.studiedModules} href="/progression" />
        <Metric
          label="Compétences officiellement validées"
          value={d.acquiredCompetencies.length}
          href="/mes-competences"
        />
      </div>
      <section>
        <h2 className="text-xl font-semibold">Modules recommandés pour votre étape</h2>
        {d.recommendedModules.length === 0 && <p>Aucune recommandation disponible.</p>}
        {d.recommendedModules.map((m) => (
          <p key={m.id}>
            <Link className="underline" href={`/modules/${m.slug}`}>
              {m.code} · {m.title}
            </Link>
          </p>
        ))}
      </section>
      <Upcoming items={d.upcomingActivities} />
      <section>
        <h2 className="text-xl font-semibold">Résultats communiqués</h2>
        {d.recentResults.length === 0 && <p>Aucun résultat communiqué.</p>}
        {d.recentResults.map((r) => (
          <p key={r.code}>
            {r.evaluationTitle} · {r.score ?? '—'}/{r.maxScore ?? '—'}
          </p>
        ))}
      </section>
      <div className="flex flex-wrap gap-4">
        <Link className="underline" href="/evaluations">
          Évaluations accessibles
        </Link>
        <Link className="underline" href="/modules">
          Bibliothèque
        </Link>
        <Link className="underline" href="/mes-resultats">
          Tous mes résultats
        </Link>
        <Link className="underline" href="/mes-activites">
          Mes activités
        </Link>
      </div>
    </div>
  );
}
