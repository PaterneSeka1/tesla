'use client';

import { useParams } from 'next/navigation';
import { CorrectionWorkspace } from '@/components/evaluations/correction-workspace';

export function CorrectionCopy() {
  const { code } = useParams<{ code: string }>();
  return (
    <CorrectionWorkspace
      code={decodeURIComponent(code)}
      backHref="/encadrement/corrections"
      backLabel="Corrections"
    />
  );
}
