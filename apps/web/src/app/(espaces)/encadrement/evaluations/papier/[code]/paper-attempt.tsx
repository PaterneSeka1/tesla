'use client';

import { useParams } from 'next/navigation';
import { CorrectionWorkspace } from '@/components/evaluations/correction-workspace';

export function PaperAttempt() {
  const { code } = useParams<{ code: string }>();
  return (
    <CorrectionWorkspace
      code={decodeURIComponent(code)}
      backHref="/encadrement/evaluations/papier"
      backLabel="Évaluations papier"
    />
  );
}
