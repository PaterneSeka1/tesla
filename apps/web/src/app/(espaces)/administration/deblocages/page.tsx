import type { Metadata } from 'next';
import { Waivers } from './waivers';

export const metadata: Metadata = { title: 'Déblocages' };

export default function Page() {
  return <Waivers />;
}
