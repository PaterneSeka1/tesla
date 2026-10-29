import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Mes compétences' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
