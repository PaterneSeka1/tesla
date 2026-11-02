'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MEDICAL_CONTACTS_MAX,
  MEDICAL_FIELD_LABELS,
  MEDICAL_RECORD_PURPOSE,
  type MedicalRecord,
  type MedicalRecordDataInput,
  medicalRecordDataSchema,
} from '@tesla/shared';
import { FileDown, HeartPulse, LoaderCircle, Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { FormField, fieldA11y } from '@/components/form-field';
import { QueryError, TableSkeleton } from '@/components/query-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

const HEALTH_FIELDS = [
  'allergies',
  'treatments',
  'emergencyInstructions',
  'precautions',
  'healthContact',
] as const;

/**
 * Fiche médicale personnelle (D135–D137) : chaque titulaire la crée, la modifie à volonté, l'imprime
 * ou la supprime. Serveur requis : jamais conservée sur l'appareil.
 */
export function MedicalRecordCard() {
  const query = useQuery(medicalRecordQueryOptions);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="size-5 text-tesla-rouge" aria-hidden />
          Fiche médicale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{MEDICAL_RECORD_PURPOSE}</p>
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

function MedicalRecordForm({ current }: { current: MedicalRecord }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const record = current.record;
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MedicalRecordDataInput>({
    resolver: zodResolver(medicalRecordDataSchema),
    defaultValues: record?.data ?? EMPTY,
  });
  const contacts = useFieldArray({ control, name: 'emergencyContacts' });

  // Fiche rechargée (après un enregistrement ou un conflit) : le formulaire repart de la version serveur.
  useEffect(() => reset(record?.data ?? EMPTY), [record, reset]);

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

  const onDelete = async () => {
    if (!record) return;
    try {
      await deleteMedicalRecord(record.revision);
      queryClient.setQueryData(medicalRecordQueryOptions.queryKey, { ...current, record: null });
      setConfirmDelete(false);
      toast.success('Fiche médicale supprimée');
    } catch (error) {
      await conflict(error);
    }
  };

  const { holder } = current;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Titulaire</dt>
          <dd>
            {holder.lastName.toUpperCase()} {holder.firstName}
          </dd>
        </div>
        {holder.birthDate && (
          <div>
            <dt className="text-muted-foreground">Date de naissance</dt>
            <dd>{formatDate(holder.birthDate)}</dd>
          </div>
        )}
        {holder.matricule && (
          <div>
            <dt className="text-muted-foreground">Matricule</dt>
            <dd>{holder.matricule}</dd>
          </div>
        )}
        {holder.team && (
          <div>
            <dt className="text-muted-foreground">Équipe</dt>
            <dd>{holder.team}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Dernière mise à jour</dt>
          <dd>{record ? formatDateTime(record.updatedAt) : 'Fiche non encore enregistrée'}</dd>
        </div>
      </dl>

      <FormField
        id="medical-phone"
        label={MEDICAL_FIELD_LABELS.phone}
        error={errors.phone?.message}
      >
        <Input
          type="tel"
          autoComplete="tel"
          {...fieldA11y('medical-phone', errors.phone?.message)}
          {...register('phone')}
        />
      </FormField>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{MEDICAL_FIELD_LABELS.emergencyContacts}</legend>
        {contacts.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun contact d’urgence.</p>
        )}
        {contacts.fields.map((field, index) => {
          const fieldErrors = errors.emergencyContacts?.[index];
          const id = (name: string) => `contact-${index}-${name}`;
          return (
            <div key={field.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
              <FormField id={id('name')} label="Nom" error={fieldErrors?.name?.message} required>
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
                  autoComplete="off"
                  {...fieldA11y(id('phone'), fieldErrors?.phone?.message)}
                  {...register(`emergencyContacts.${index}.phone`)}
                />
              </FormField>
              <div className="sm:col-span-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => contacts.remove(index)}
                >
                  <Trash2 aria-hidden />
                  Retirer ce contact
                </Button>
              </div>
            </div>
          );
        })}
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
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Informations de santé (facultatives)</legend>
        {HEALTH_FIELDS.map((name) => (
          <FormField
            key={name}
            id={`medical-${name}`}
            label={MEDICAL_FIELD_LABELS[name]}
            error={errors[name]?.message}
          >
            <Textarea
              rows={2}
              {...fieldA11y(`medical-${name}`, errors[name]?.message)}
              {...register(name)}
            />
          </FormField>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-2">
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
          </>
        )}
      </div>
      {isDirty && record && (
        <p className="text-xs text-muted-foreground">
          Enregistrez vos changements avant d’imprimer : le PDF reprend la version enregistrée.
        </p>
      )}

      {record &&
        (confirmDelete ? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-3">
              <p>La fiche sera définitivement effacée. Aucune copie n’est conservée.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void onDelete()}
                >
                  Supprimer définitivement
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Annuler
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden />
            Supprimer ma fiche médicale
          </Button>
        ))}
    </form>
  );
}
