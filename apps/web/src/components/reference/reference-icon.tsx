import { type ReferenceIcon as ReferenceIconName } from '@tesla/shared';
import {
  BookOpen,
  Compass,
  Flame,
  Heart,
  type LucideIcon,
  Music,
  ScrollText,
  Shield,
  Star,
  Tent,
} from 'lucide-react';

const ICONS: Record<ReferenceIconName, LucideIcon> = {
  flamme: Flame,
  livre: BookOpen,
  musique: Music,
  parchemin: ScrollText,
  etoile: Star,
  bouclier: Shield,
  boussole: Compass,
  tente: Tent,
  coeur: Heart,
};

/** Icône d'une rubrique du référentiel (liste blanche), parchemin par défaut. */
export function ReferenceIconView({
  name,
  className,
}: {
  name: ReferenceIconName | null;
  className?: string;
}) {
  const Icon = name ? ICONS[name] : ScrollText;
  return <Icon className={className} aria-hidden />;
}
