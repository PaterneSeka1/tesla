import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Progression' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
