import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DependencyHealth, HealthResponse } from '@fh/shared';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

const SERVICE_NAME = 'family-heritage-api';
const SERVICE_VERSION = '0.1.0';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async check(): Promise<HealthResponse> {
    const dependencies: DependencyHealth[] = [await this.checkDatabase()];
    const degraded = dependencies.some((dependency) => dependency.status !== 'ok');

    return {
      status: degraded ? 'degraded' : 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: this.config.get('NODE_ENV', { infer: true }),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      await this.prisma.ping();
      return { name: 'postgres', status: 'ok', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        name: 'postgres',
        status: 'degraded',
        latencyMs: Date.now() - startedAt,
        // The message is generic on purpose: a Prisma error string can contain
        // the connection string, and /health is the least protected route.
        message: error instanceof Error ? 'Database unreachable' : 'Unknown database error',
      };
    }
  }
}
