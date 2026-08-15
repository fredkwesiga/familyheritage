import { Injectable, Logger } from '@nestjs/common';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  familyId: string;
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  diff?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

/**
 * Append-only record of who changed what.
 *
 * Not compliance theatre. In a family archive with several contributors,
 * "who changed grandmother's birth year?" is a question that will be asked, and
 * being able to answer it prevents real arguments between real relatives.
 *
 * Writes never fail the operation they describe. Losing an audit line is bad;
 * refusing to save a family's story because the audit write failed is worse.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.scoped.auditLog.create({
        data: {
          familyId: entry.familyId,
          actorUserId: entry.actorUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          summary: entry.summary ?? null,
          diff: entry.diff,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent?.slice(0, 500) ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry ${entry.action} for family ${entry.familyId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Builds a { field: { from, to } } diff, skipping unchanged values.
   * Used by every update path so audit entries stay small and readable.
   */
  static diffOf<T extends Record<string, unknown>>(
    before: T,
    after: Partial<T>,
  ): Prisma.InputJsonValue {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, next] of Object.entries(after)) {
      if (next !== undefined && before[key] !== next) {
        diff[key] = { from: before[key] ?? null, to: next ?? null };
      }
    }
    return diff as Prisma.InputJsonValue;
  }
}