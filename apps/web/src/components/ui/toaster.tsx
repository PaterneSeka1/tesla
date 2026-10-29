'use client';

import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { Toast } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const ToastContext = React.createContext<((toast: Omit<ToastItem, 'id'>) => void) | null>(null);

/** Notifications de succès ou d'erreur (annoncées aux lecteurs d'écran). */
export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((toast: Omit<ToastItem, 'id'>) => {
    setToasts((current) => [...current, { ...toast, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <ToastContext value={push}>
      <Toast.Provider swipeDirection="right" duration={5000} label="Notification">
        {children}
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            type={toast.variant === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => {
              if (!open) setToasts((current) => current.filter((item) => item.id !== toast.id));
            }}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border bg-card p-4 shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4',
              toast.variant === 'error' ? 'border-destructive/40' : 'border-emerald-300',
            )}
          >
            {toast.variant === 'error' ? (
              <CircleAlert className="mt-0.5 size-5 text-destructive" aria-hidden />
            ) : (
              <CircleCheck className="mt-0.5 size-5 text-emerald-700" aria-hidden />
            )}
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
      error: (title: string, description?: string) =>
        push({ title, description, variant: 'error' }),
    }),
    [push],
  );
}
