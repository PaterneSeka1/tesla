'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Champ secret avec bouton d'affichage (mot de passe, phrase locale du coffre). Le bouton est
 * annoncé par son libellé et son état (`aria-pressed`) ; le texte n'est jamais affiché par défaut.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Masquer le texte saisi' : 'Afficher le texte saisi'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-tesla-rouge focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icon key={String(visible)} className="size-4 animate-pop" aria-hidden />
      </button>
    </div>
  );
}
