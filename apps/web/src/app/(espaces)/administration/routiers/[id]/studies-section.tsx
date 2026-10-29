'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  type ScoutProgression,
  STUDY_MODE_LABELS,
  STUDY_MODES,
  type StudyMode,
} from '@tesla/shared';
import { BookOpen } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSessionUser } from '@/components/auth/session-gate';
import { userCan } from '@/lib/navigation';
import { EmptyState } from '@/components/empty-state';
import { FormField, fieldA11y } from '@/components/form-field';
import { CommentDialog } from '@/components/modules/comment-dialog';
import { usePedagogyAction } from '@/components/progression/use-pedagogy-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  cancelModuleStudy,
  publishedModulesQueryOptions,
  recordModuleStudy,
} from '@/lib/api/progression';
import { formatDate, fullName, todayIsoDate } from '@/lib/format';

const formSchema = z.object({
  moduleId: z.string().min(1, { error: 'Choisissez un module.' }),
  mode: z.enum(STUDY_MODES, { error: 'Choisissez une modalité.' }),
  studiedOn: z.iso.date({ error: 'Date invalide.' }),
  observation: z.string().max(1000, { error: '1 000 caractères au maximum.' }),
});

type FormValues = z.infer<typeof formSchema>;

/** Modules étudiés : information de suivi, distincte de la maîtrise et de la validation. */
export function StudiesSection({ progression }: { progression: ScoutProgression }) {
  const user = useSessionUser();
  const run = usePedagogyAction();
  const modules = useQuery(publishedModulesQueryOptions);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      moduleId: '',
      mode: 'COURS_PAPIER' as StudyMode,
      studiedOn: todayIsoDate(),
      observation: '',
    },
  });

  const submit = async (values: FormValues) => {
    const ok = await run(() => recordModuleStudy(progression.scout.id, values), {
      success: 'Étude enregistrée',
      error: 'Enregistrement impossible',
    });
    if (ok) reset();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Modules étudiés</CardTitle>
          <CardDescription>
            Lecture, cours papier ou formation collective. Étudier un module ne signifie pas qu’il
            est maîtrisé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {progression.moduleStudies.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Aucune étude enregistrée"
              description="Les études de modules apparaîtront ici."
            />
          ) : (
            progression.moduleStudies.map((study) => (
              <div key={study.id} className="space-y-1 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={study.cancelledAt ? 'line-through' : 'font-medium'}>
                    {study.module.code} {study.module.title}
                  </span>
                  <Badge variant="outline">{STUDY_MODE_LABELS[study.mode]}</Badge>
                  {study.selfDeclared && <Badge variant="secondary">Déclarée par le routier</Badge>}
                  {study.cancelledAt && <Badge variant="outline">Annulée</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Le {formatDate(study.studiedOn)}
                  {study.moduleVersion && ` · version ${study.moduleVersion}`}
                  {study.activity && ` · activité « ${study.activity.title} »`} · saisie par{' '}
                  {fullName(study.recordedBy)}
                </p>
                {study.observation && <p>{study.observation}</p>}
                {study.cancelReason && (
                  <p className="text-xs text-muted-foreground">
                    Motif d’annulation : {study.cancelReason}
                  </p>
                )}
                {!study.cancelledAt &&
                  (study.recordedBy.id === user.id || userCan(user, 'scout.update')) && (
                    <CommentDialog
                      trigger={
                        <Button size="sm" variant="outline">
                          Annuler la saisie
                        </Button>
                      }
                      title="Annuler cette saisie ?"
                      description={<p>La saisie reste visible, marquée comme annulée.</p>}
                      label="Motif"
                      required
                      destructive
                      confirmLabel="Annuler la saisie"
                      onConfirm={(reason) =>
                        run(() => cancelModuleStudy(study.id, { reason }), {
                          success: 'Saisie annulée',
                          error: 'Annulation impossible',
                        })
                      }
                    />
                  )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enregistrer une étude</CardTitle>
          <CardDescription>
            Pour un routier avec ou sans compte (cours papier, séance collective…).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => void handleSubmit(submit)(event)}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                id="study-module"
                label="Module publié"
                required
                error={errors.moduleId?.message}
              >
                <NativeSelect
                  {...fieldA11y('study-module', errors.moduleId?.message)}
                  {...register('moduleId')}
                >
                  <option value="">Choisir…</option>
                  {modules.data?.items.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.code} — {module.title}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="study-mode" label="Modalité" required error={errors.mode?.message}>
                <NativeSelect
                  {...fieldA11y('study-mode', errors.mode?.message)}
                  {...register('mode')}
                >
                  {STUDY_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {STUDY_MODE_LABELS[mode]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="study-date" label="Date" required error={errors.studiedOn?.message}>
                <Input
                  {...fieldA11y('study-date', errors.studiedOn?.message)}
                  type="date"
                  max={todayIsoDate()}
                  {...register('studiedOn')}
                />
              </FormField>
            </div>
            <FormField
              id="study-observation"
              label="Observation (facultative)"
              error={errors.observation?.message}
            >
              <Textarea
                {...fieldA11y('study-observation', errors.observation?.message)}
                rows={2}
                {...register('observation')}
              />
            </FormField>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer l’étude'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
