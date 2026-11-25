import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Parcours des routiers' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
