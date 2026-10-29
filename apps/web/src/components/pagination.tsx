import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground">
        Page {page} sur {pageCount} · {total} résultat{total > 1 ? 's' : ''}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft aria-hidden />
          <span className="sr-only sm:not-sr-only">Précédente</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          <span className="sr-only sm:not-sr-only">Suivante</span>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
