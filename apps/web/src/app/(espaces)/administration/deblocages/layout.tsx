import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Déblocages' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
