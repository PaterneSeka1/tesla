import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Référentiel d’âge' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
