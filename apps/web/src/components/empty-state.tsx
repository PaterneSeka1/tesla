import { type LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Action de sortie de l'état vide (ex. réinitialiser les filtres). */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex animate-fade flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-8 text-center">
      <Icon className="size-6 animate-pop text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
