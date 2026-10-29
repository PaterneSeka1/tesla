import type { Metadata } from 'next';
import { Catalog } from './catalog';

export const metadata: Metadata = { title: 'Bibliothèque' };

export default function CatalogPage() {
  return <Catalog />;
}
