import type { MetadataRoute } from 'next';
import { buildRobots } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return buildRobots();
}
