import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Loaded relative to the API workspace root, which is where we run Nest.
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
