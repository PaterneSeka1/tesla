import { type PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

function createService(queryRaw: () => Promise<unknown>): HealthService {
  return new HealthService({ $queryRaw: queryRaw } as unknown as PrismaService);
}

describe('HealthService', () => {
  it('indique « ok » quand la base répond', async () => {
    const result = await createService(() => Promise.resolve([1])).check();
    expect(result).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('indique « degraded » quand la base est injoignable', async () => {
    const result = await createService(() => Promise.reject(new Error('ECONNREFUSED'))).check();
    expect(result).toMatchObject({ status: 'degraded', database: 'down' });
  });
});
