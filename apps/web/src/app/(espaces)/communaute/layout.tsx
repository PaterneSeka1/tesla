import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Encadrement' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
