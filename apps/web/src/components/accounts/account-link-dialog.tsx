'use client';

import { type AccountLink } from '@tesla/shared';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toaster';
import { accountLinkUrl } from '@/lib/api/accounts';
import { formatDateTime } from '@/lib/format';

/**
 * Lien à usage unique affiché une seule fois après son émission : il n'est jamais relisible.
 * À transmettre au titulaire par un canal personnel ; quiconque le possède peut choisir le mot de passe.
 */
export function AccountLinkDialog({
  link,
  name,
  onClose,
}: {
  link: AccountLink | null;
  name: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const url = link ? accountLinkUrl(link.token, link.purpose) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
    } catch {
      toast.error('Copie impossible', 'Sélectionnez le lien puis copiez-le.');
    }
  };
  return (
    <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {link?.purpose === 'ACTIVATION' ? 'Lien d’activation' : 'Lien de réinitialisation'}
          </DialogTitle>
          <DialogDescription>
            {link?.sentByEmail
              ? `Envoyé par e-mail à ${name}. `
              : `À transmettre uniquement à ${name}, par un canal personnel, après vérification de son identité. `}
            Usage unique, valable jusqu’au {link ? formatDateTime(link.expiresAt) : ''} ; il ne sera
            plus affiché.
          </DialogDescription>
        </DialogHeader>
        <Input
          readOnly
          value={url}
          aria-label="Lien à transmettre"
          onFocus={(e) => e.target.select()}
        />
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Si le lien ne s’ouvre pas : code à saisir avec l’adresse e-mail du compte.
          </p>
          <p
            className="font-mono text-lg font-semibold tracking-widest"
            aria-label="Code de secours"
          >
            {link?.code}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={() => void copy()}>
            <Copy aria-hidden />
            Copier le lien
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
