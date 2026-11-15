'use client';

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Toast } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'info' | 'warning' | 'error';

/** Durée d'affichage : une erreur reste plus longtemps pour être lue (fermeture manuelle possible). */
const DURATION: Record<ToastVariant, number> = {
  success: 5000,
  info: 6000,
  warning: 8000,
  error: 10000,
};
const STYLE: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
  success: {
    border: 'border-emerald-300',
    icon: <CircleCheck className="mt-0.5 size-5 text-emerald-700" aria-hidden />,
  },
  info: {
    border: 'border-tesla-or/60',
    icon: <Info className="mt-0.5 size-5 text-tesla-bordeaux" aria-hidden />,
  },
  warning: {
    border: 'border-amber-400',
    icon: <TriangleAlert className="mt-0.5 size-5 text-amber-700" aria-hidden />,
  },
  error: {
    border: 'border-destructive/40',
    icon: <CircleAlert className="mt-0.5 size-5 text-destructive" aria-hidden />,
  },
};

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const ToastContext = React.createContext<((toast: Omit<ToastItem, 'id'>) => void) | null>(null);

/**
 * Notifications (succès, information, avertissement, erreur), annoncées aux lecteurs d'écran.
 * Une notification identique déjà affichée n'est pas répétée ; animation désactivée si la personne
 * réduit les animations (`motion-safe`).
 */
export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((toast: Omit<ToastItem, 'id'>) => {
    setToasts((current) =>
      current.some(
        (item) =>
          item.title === toast.title &&
          item.description === toast.description &&
          item.variant === toast.variant,
      )
        ? current
        : [...current, { ...toast, id: Date.now() + Math.random() }],
    );
  }, []);

  return (
    <ToastContext value={push}>
      <Toast.Provider swipeDirection="right" duration={5000} label="Notification">
        {children}
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            type={
              toast.variant === 'error' || toast.variant === 'warning' ? 'foreground' : 'background'
            }
            duration={DURATION[toast.variant]}
            onOpenChange={(open) => {
              if (!open) setToasts((current) => current.filter((item) => item.id !== toast.id));
            }}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border bg-card p-4 shadow-lg',
              'motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom-4',
              STYLE[toast.variant].border,
            )}
          >
            {STYLE[toast.variant].icon}
            <div className="space-y-1">
              <Toast.Title className="text-sm font-semibold">{toast.title}</Toast.Title>
              {toast.description && (
                <Toast.Description className="text-sm text-muted-foreground">
                  {toast.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close className="rounded-sm opacity-70 hover:opacity-100" aria-label="Fermer">
              <X className="size-4" aria-hidden />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed right-0 bottom-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </Toast.Provider>
    </ToastContext>
  );
}

export function useToast() {
  const push = React.use(ToastContext);
  if (!push) throw new Error('useToast doit être utilisé sous <Toaster>.');
  // Référence stable : utilisable comme dépendance d'un effet.
  return React.useMemo(
    () => ({
      success: (title: string, description?: string) =>
        push({ title, description, variant: 'success' }),
      info: (title: string, description?: string) => push({ title, description, variant: 'info' }),
      warning: (title: string, description?: string) =>
        push({ title, description, variant: 'warning' }),
      error: (title: string, description?: string) =>
        push({ title, description, variant: 'error' }),
    }),
    [push],
  );
}
