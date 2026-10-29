import type { Metadata } from 'next';
import { ValidationsBoard } from './validations-board';

export const metadata: Metadata = { title: 'Validations des acquis' };

export default function Page() {
  return <ValidationsBoard />;
}
