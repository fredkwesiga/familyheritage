import { healthResponseSchema, type HealthResponse } from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

export const healthQueryKey = ['health'] as const;

export function fetchHealth(): Promise<HealthResponse> {
  return apiRequest('/health', healthResponseSchema);
}
