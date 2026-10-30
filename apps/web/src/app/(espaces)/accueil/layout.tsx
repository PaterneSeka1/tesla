import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Accueil' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
