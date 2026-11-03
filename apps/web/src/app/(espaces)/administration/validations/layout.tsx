import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Acquis et propositions' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
