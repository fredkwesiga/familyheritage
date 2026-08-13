import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@fh/shared';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Service and dependency health',
    description:
      'Returns "ok" when every dependency responds, "degraded" otherwise. Always HTTP 200 so ' +
      'that a platform health check distinguishes "process is up" from "database is down".',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
        service: { type: 'string', example: 'family-heritage-api' },
        version: { type: 'string', example: '0.1.0' },
        environment: { type: 'string', example: 'development' },
        uptimeSeconds: { type: 'number', example: 42 },
        timestamp: { type: 'string', example: '2026-08-13T09:00:00.000Z' },
        dependencies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'postgres' },
              status: { type: 'string', enum: ['ok', 'degraded'] },
              latencyMs: { type: 'number', example: 3 },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  })
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
