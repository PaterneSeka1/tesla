import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-tesla-rouge underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
