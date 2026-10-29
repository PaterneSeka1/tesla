import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Mes activités' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
