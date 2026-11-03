import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Compétences' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
