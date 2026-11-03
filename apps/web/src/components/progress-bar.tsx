import { cn } from '@/lib/utils';

/** Barre de progression accessible (`role="progressbar"`), valeur bornée à [min, max]. */
export function ProgressBar({
  value,
  max,
  min = 0,
  label,
  valueText,
  tone = 'rouge',
  className,
}: {
  value: number;
  max: number;
  min?: number;
  label: string;
  /** Valeur lue par les lecteurs d'écran (« 4 séances sur 14 »). */
  valueText?: string;
  tone?: 'rouge' | 'or';
  className?: string;
}) {
  const span = max - min;
  const percent = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
    >
      <div
        className={cn('h-full transition-all', tone === 'rouge' ? 'bg-tesla-rouge' : 'bg-tesla-or')}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
