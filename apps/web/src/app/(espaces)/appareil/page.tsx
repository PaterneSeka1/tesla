import type { Metadata } from 'next';
import { DevicePanel } from '@/components/offline/device-panel';

export const metadata: Metadata = { title: 'Cet appareil' };

export default function Page() {
  return <DevicePanel />;
}
