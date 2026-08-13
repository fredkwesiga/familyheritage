import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { Env } from './config/env.schema';

export const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Fastify generates a request id per request; the exception filter echoes
      // it to the client so a user-reported error maps to a log line.
      genReqId: () => crypto.randomUUID(),
      trustProxy: true,
      bodyLimit: 1_048_576, // 1 MB. Photo uploads go straight to Cloudinary, not through here.
    }),
  );

  const config = app.get(ConfigService<Env, true>);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const port = config.get('PORT', { infer: true });
  const webOrigin = config.get('WEB_ORIGIN', { infer: true });

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await app.register(helmet, {
    // Swagger UI needs inline styles/scripts; everything else stays locked down.
    contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
  });

  app.enableCors({
    origin: webOrigin,
    credentials: true, // required from Phase 3: the session cookie is httpOnly
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Family Heritage API')
        .setDescription('Preserve a family lineage, photographs and stories.')
        .setVersion('0.1.0')
        .addCookieAuth('fh_session')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });
    logger.log(`Swagger UI      http://localhost:${port}/api/docs`);
  }

  // 0.0.0.0 rather than localhost: required inside containers and by most PaaS.
  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`API listening   http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Environment     ${nodeEnv}`);
}

void bootstrap();
