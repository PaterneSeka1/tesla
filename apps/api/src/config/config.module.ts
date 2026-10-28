import { Global, Module } from '@nestjs/common';
import { validateEnv } from './env.js';

export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => validateEnv(process.env) }],
  exports: [ENV],
})
export class ConfigModule {}
