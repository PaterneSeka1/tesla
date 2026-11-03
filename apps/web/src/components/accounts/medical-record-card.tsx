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
import { useEffect, useState } from 'react';
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
import { formatDate, formatDateTime } from '@/lib/format';

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

/** Champs de texte libre affichés à la demande (sections 3 et 4). */
type RevealedField = (typeof HEALTH.fields)[number] | (typeof INSTRUCTIONS.fields)[number];

/**
 * Fiche médicale personnelle (D135–D137) en quatre sections (`MEDICAL_RECORD_SECTIONS`) : chaque
 * titulaire la crée, la modifie à volonté, l'imprime ou la supprime. Serveur requis : jamais
 * conservée sur l'appareil.
 */
export function MedicalRecordCard() {
  const query = useQuery(medicalRecordQueryOptions);
  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle>
          <h2 className="flex items-center gap-2 text-base">
            <HeartPulse className="size-5 text-tesla-rouge" aria-hidden />
            Fiche médicale
          </h2>
        </CardTitle>
        <p className="flex items-start gap-2 rounded-lg bg-tesla-sable/40 p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-tesla-rouge" aria-hidden />
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
    <section aria-labelledby={id} className="space-y-4 rounded-xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tesla-bordeaux text-sm font-semibold text-white"
          aria-hidden
        >
          {index}
        </span>
        <div className="min-w-0 space-y-0.5">
          <h3 id={id} className="font-semibold text-tesla-bordeaux">
            {title}
          </h3>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
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

  const { holder } = current;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {record
          ? `Dernière modification : ${formatDateTime(record.updatedAt)}`
          : 'Fiche non encore enregistrée. Tous les champs sont facultatifs.'}
      </p>

      <Section index={1} title={PERSONAL.title} hint="Repris de votre compte et de votre fiche.">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Fact
            label="Nom et prénoms"
            value={`${holder.lastName.toUpperCase()} ${holder.firstName}`}
          />
          <Fact
            label="Date de naissance"
            value={holder.birthDate ? formatDate(holder.birthDate) : 'Non renseignée'}
          />
          {holder.matricule && <Fact label="Matricule" value={holder.matricule} />}
          {holder.team && <Fact label="Équipe" value={holder.team} />}
        </dl>
        <div className="sm:max-w-sm">
          <FormField
            id="medical-phone"
            label={MEDICAL_FIELD_LABELS.phone}
            hint={MEDICAL_FIELD_HINTS.phone}
            error={errors.phone?.message}
          >
            <Input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              {...fieldA11y('medical-phone', errors.phone?.message, MEDICAL_FIELD_HINTS.phone)}
              {...register('phone')}
            />
          </FormField>
        </div>
      </Section>

      <Section index={2} title={CONTACTS.title} hint={MEDICAL_FIELD_HINTS.emergencyContacts}>
        {contacts.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun contact d’urgence.</p>
        )}
        <ul className="space-y-3">
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
                    hint="Parent, tuteur, conjoint…"
                    error={fieldErrors?.relation?.message}
                    required
                  >
                    <Input
                      autoComplete="off"
                      {...fieldA11y(id('relation'), fieldErrors?.relation?.message, 'hint')}
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

      <Section
        index={3}
        title={HEALTH.title}
        hint="À ajouter seulement si c’est utile aux secours."
      >
        {HEALTH.fields.map((name) => (
          <RevealTextField key={name} name={name} form={form} />
        ))}
      </Section>

      <Section index={4} title={INSTRUCTIONS.title}>
        {INSTRUCTIONS.fields.map((name) => (
          <RevealTextField key={name} name={name} form={form} />
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
                Aperçu et impression
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={medicalRecordPdfUrl()} download="fiche-medicale.pdf">
                <FileDown aria-hidden />
                Télécharger (PDF)
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
      {isDirty && record && (
        <p className="text-xs text-muted-foreground" role="status">
          Modifications non enregistrées : le PDF reprend la version enregistrée.
        </p>
      )}
    </form>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/**
 * Texte libre facultatif, affiché à la demande : un champ vide reste replié derrière un bouton
 * « Ajouter », un champ renseigné est ouvert. Retirer vide le champ (enregistré comme non renseigné).
 * Simple affichage : aucune réponse « oui / non » n'est enregistrée.
 */
function RevealTextField({
  name,
  form,
}: {
  name: RevealedField;
  form: UseFormReturn<MedicalRecordDataInput>;
}) {
  const {
    register,
    setValue,
    setFocus,
    watch,
    formState: { errors },
  } = form;
  const filled = Boolean(watch(name));
  // Un champ renseigné (saisi ou rechargé depuis le serveur) reste toujours affiché.
  const [opened, setOpen] = useState(false);
  const open = opened || filled;
  const id = `medical-${name}`;
  const label = MEDICAL_FIELD_LABELS[name];
  const hint = MEDICAL_FIELD_HINTS[name];
  const error = errors[name]?.message;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => setFocus(name));
        }}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-tesla-or hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Plus className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium text-foreground">{label}</span>
          <span className="block text-xs">{hint}</span>
        </span>
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <FormField id={id} label={label} hint={hint} error={error}>
        <Textarea rows={3} maxLength={1000} {...fieldA11y(id, error, hint)} {...register(name)} />
      </FormField>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setValue(name, '', { shouldDirty: true });
          setOpen(false);
        }}
      >
        <X aria-hidden />
        Retirer
      </Button>
    </div>
  );
}
