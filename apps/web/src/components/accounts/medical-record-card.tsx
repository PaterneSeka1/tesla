'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MEDICAL_CONTACTS_MAX,
  MEDICAL_FIELD_HINTS,
  MEDICAL_FIELD_LABELS,
  MEDICAL_RECORD_PURPOSE,
  MEDICAL_RECORD_SECTIONS,
  type MedicalRecord,
  type MedicalRecordDataInput,
  medicalRecordDataSchema,
} from '@tesla/shared';
import { FileDown, HeartPulse, LoaderCircle, Lock, Plus, Printer, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import { type UseFormReturn, useFieldArray, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField, fieldA11y } from '@/components/form-field';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import { ApiError } from '@/lib/api/client';
import {
  deleteMedicalRecord,
  medicalRecordPdfUrl,
  medicalRecordQueryOptions,
  saveMedicalRecord,
} from '@/lib/api/medical';
import { formatDateTime } from '@/lib/format';

const EMPTY: MedicalRecordDataInput = {
  phone: '',
  emergencyContacts: [],
  allergies: '',
  treatments: '',
  emergencyInstructions: '',
  precautions: '',
  healthContact: '',
};

const [PERSONAL, CONTACTS, HEALTH, INSTRUCTIONS] = MEDICAL_RECORD_SECTIONS;

/** Champs de texte libre (sections 3 et 4). */
type FreeTextName = (typeof HEALTH.fields)[number] | (typeof INSTRUCTIONS.fields)[number];

/**
 * Fiche médicale personnelle (D135–D137) en quatre sections (`MEDICAL_RECORD_SECTIONS`) : chaque
 * titulaire la crée, la modifie à volonté, l'imprime ou la supprime. Serveur requis : jamais
 * conservée sur l'appareil.
 */
export function MedicalRecordCard() {
  const query = useQuery(medicalRecordQueryOptions);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <HeartPulse className="size-5 text-tesla-rouge" aria-hidden />
            Fiche médicale
          </h2>
        </CardTitle>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{MEDICAL_RECORD_PURPOSE}</span>
        </p>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <TableSkeleton rows={4} />
        ) : query.isError ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <MedicalRecordForm current={query.data} />
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  index,
  title,
  hint,
  children,
}: {
  index: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = `medical-section-${index}`;
  return (
    <section aria-labelledby={id} className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="space-y-0.5">
        <h3 id={id} className="font-semibold text-tesla-bordeaux">
          {title}
        </h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function MedicalRecordForm({ current }: { current: MedicalRecord }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const record = current.record;
  const form = useForm<MedicalRecordDataInput>({
    resolver: zodResolver(medicalRecordDataSchema),
    defaultValues: record?.data ?? EMPTY,
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  const contacts = useFieldArray({ control, name: 'emergencyContacts' });

  // Fiche rechargée (après un enregistrement ou un conflit) : le formulaire repart de la version serveur.
  useEffect(() => reset(record?.data ?? EMPTY), [record, reset]);

  // Modifications non enregistrées : le navigateur demande confirmation avant de quitter la page.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const conflict = async (error: unknown) => {
    if (error instanceof ApiError && error.code === 'MEDICAL_RECORD_CHANGED') {
      await queryClient.invalidateQueries({ queryKey: medicalRecordQueryOptions.queryKey });
      toast.error('Fiche modifiée entre-temps', 'La version à jour a été rechargée.');
      return;
    }
    toast.error('Enregistrement impossible', error instanceof Error ? error.message : undefined);
  };

  const onSubmit = async (data: MedicalRecordDataInput) => {
    try {
      const saved = await saveMedicalRecord({ expectedRevision: record?.revision ?? null, data });
      queryClient.setQueryData(medicalRecordQueryOptions.queryKey, saved);
      toast.success('Fiche médicale enregistrée');
    } catch (error) {
      await conflict(error);
    }
  };

  const onDelete = async (): Promise<boolean> => {
    if (!record) return false;
    try {
      await deleteMedicalRecord(record.revision);
      queryClient.setQueryData(medicalRecordQueryOptions.queryKey, { ...current, record: null });
      toast.success('Fiche médicale supprimée');
      return true;
    } catch (error) {
      await conflict(error);
      return false;
    }
  };

  // Identité du titulaire : affichée par « Mon profil » et reprise dans le PDF, pas répétée ici.
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Section index={1} title={PERSONAL.title}>
        <div className="sm:max-w-sm">
          <FormField
            id="medical-phone"
            label={MEDICAL_FIELD_LABELS.phone}
            error={errors.phone?.message}
          >
            <Input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              {...fieldA11y('medical-phone', errors.phone?.message)}
              {...register('phone')}
            />
          </FormField>
        </div>
      </Section>

      <Section index={2} title={CONTACTS.title} hint={MEDICAL_FIELD_HINTS.emergencyContacts}>
        <ul className="space-y-3 empty:hidden">
          {contacts.fields.map((field, index) => {
            const fieldErrors = errors.emergencyContacts?.[index];
            const id = (name: string) => `contact-${index}-${name}`;
            return (
              <li key={field.id} className="space-y-3 rounded-lg bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Contact {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => contacts.remove(index)}
                    aria-label={`Retirer le contact ${index + 1}`}
                  >
                    <X aria-hidden />
                    Retirer
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField
                    id={id('name')}
                    label="Nom"
                    error={fieldErrors?.name?.message}
                    required
                  >
                    <Input
                      autoComplete="off"
                      {...fieldA11y(id('name'), fieldErrors?.name?.message)}
                      {...register(`emergencyContacts.${index}.name`)}
                    />
                  </FormField>
                  <FormField
                    id={id('relation')}
                    label="Lien"
                    error={fieldErrors?.relation?.message}
                    required
                  >
                    <Input
                      autoComplete="off"
                      placeholder="Parent, tuteur…"
                      {...fieldA11y(id('relation'), fieldErrors?.relation?.message)}
                      {...register(`emergencyContacts.${index}.relation`)}
                    />
                  </FormField>
                  <FormField
                    id={id('phone')}
                    label="Téléphone"
                    error={fieldErrors?.phone?.message}
                    required
                  >
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      {...fieldA11y(id('phone'), fieldErrors?.phone?.message)}
                      {...register(`emergencyContacts.${index}.phone`)}
                    />
                  </FormField>
                </div>
              </li>
            );
          })}
        </ul>
        {contacts.fields.length < MEDICAL_CONTACTS_MAX && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => contacts.append({ name: '', relation: '', phone: '' })}
          >
            <Plus aria-hidden />
            Ajouter un contact d’urgence
          </Button>
        )}
        <FormField
          id="medical-healthContact"
          label={MEDICAL_FIELD_LABELS.healthContact}
          hint={MEDICAL_FIELD_HINTS.healthContact}
          error={errors.healthContact?.message}
        >
          <Input
            autoComplete="off"
            maxLength={300}
            {...fieldA11y(
              'medical-healthContact',
              errors.healthContact?.message,
              MEDICAL_FIELD_HINTS.healthContact,
            )}
            {...register('healthContact')}
          />
        </FormField>
      </Section>

      <Section index={3} title={HEALTH.title}>
        {HEALTH.fields.map((name) => (
          <FreeTextField key={name} name={name} form={form} />
        ))}
      </Section>

      <Section index={4} title={INSTRUCTIONS.title}>
        {INSTRUCTIONS.fields.map((name) => (
          <FreeTextField key={name} name={name} form={form} />
        ))}
      </Section>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button type="submit" disabled={isSubmitting || (!isDirty && record !== null)}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
        {record && (
          <>
            <Button asChild variant="outline">
              <a href={medicalRecordPdfUrl()} target="_blank" rel="noopener">
                <Printer aria-hidden />
                Imprimer
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={medicalRecordPdfUrl()} download="fiche-medicale.pdf">
                <FileDown aria-hidden />
                Télécharger
              </a>
            </Button>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" className="text-destructive sm:ml-auto">
                  <Trash2 aria-hidden />
                  Supprimer ma fiche
                </Button>
              }
              title="Supprimer votre fiche médicale ?"
              description={
                <p>La fiche sera définitivement effacée. Aucune copie n’est conservée.</p>
              }
              confirmLabel="Supprimer définitivement"
              destructive
              onConfirm={onDelete}
            />
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {isDirty && record
          ? 'Modifications non enregistrées : le PDF reprend la version enregistrée.'
          : record && `Modifiée le ${formatDateTime(record.updatedAt)}`}
      </p>
    </form>
  );
}

/** Texte libre, toujours affiché : un champ vide est enregistré comme non renseigné. */
function FreeTextField({
  name,
  form: {
    register,
    formState: { errors },
  },
}: {
  name: FreeTextName;
  form: UseFormReturn<MedicalRecordDataInput>;
}) {
  const id = `medical-${name}`;
  const hint = MEDICAL_FIELD_HINTS[name];
  const error = errors[name]?.message;
  return (
    <FormField id={id} label={MEDICAL_FIELD_LABELS[name]} hint={hint} error={error}>
      <Textarea rows={2} maxLength={1000} {...fieldA11y(id, error, hint)} {...register(name)} />
    </FormField>
  );
}
