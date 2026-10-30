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
  const url = link ? accountLinkUrl(link.token) : '';
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
            À transmettre uniquement à {name}, par un canal personnel. Il ne fonctionne qu’une fois,
            jusqu’au {link ? formatDateTime(link.expiresAt) : ''}, et ne sera plus affiché.
          </DialogDescription>
        </DialogHeader>
        <Input
          readOnly
          value={url}
          aria-label="Lien à transmettre"
          onFocus={(e) => e.target.select()}
        />
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
