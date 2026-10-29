'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** Action éditoriale accompagnée d'un commentaire (motif obligatoire ou note facultative). */
export function CommentDialog({
  trigger,
  title,
  description,
  label,
  required = false,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  label: string;
  required?: boolean;
  confirmLabel: string;
  destructive?: boolean;
  /** Renvoie `true` si l'action a réussi (le dialogue se ferme). */
  onConfirm: (comment: string) => Promise<boolean>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState(false);

  const confirm = async () => {
    if (required && !comment.trim()) {
      setMissing(true);
      return;
    }
    setPending(true);
    const ok = await onConfirm(comment.trim());
    setPending(false);
    if (ok) {
      setOpen(false);
      setComment('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">{description}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor={`${id}-comment`}>
            {label}
            {required && (
              <span className="text-destructive" aria-hidden>
                *
              </span>
            )}
          </Label>
          <Textarea
            id={`${id}-comment`}
            rows={4}
            maxLength={2000}
            value={comment}
            aria-invalid={missing || undefined}
            aria-describedby={missing ? `${id}-error` : undefined}
            onChange={(event) => {
              setComment(event.target.value);
              setMissing(false);
            }}
          />
          {missing && (
            <p id={`${id}-error`} className="text-sm text-destructive">
              Le motif est obligatoire.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Annuler
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void confirm()}
            disabled={pending}
          >
            {pending ? 'Traitement…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
