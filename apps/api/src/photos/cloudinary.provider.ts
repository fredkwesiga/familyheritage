import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.schema';
import type { SignedUpload, StorageProvider, StoredAsset } from './storage.provider';

/**
 * Cloudinary, configured for private family photographs.
 *
 * Three settings carry all the weight, and the default for each is wrong for
 * this product:
 *
 * 1. type: 'authenticated'. Cloudinary's default is public delivery - anyone
 *    with, or guessing, the URL gets the file. For a family's photographs that
 *    is unacceptable, so assets are stored authenticated and every delivery URL
 *    is signed by us after we have checked membership.
 *
 * 2. Signed uploads. The alternative is an unsigned upload preset, which lets
 *    anyone on the internet write into the account. Every upload here carries a
 *    signature generated from the API secret, which never leaves the server.
 *
 * 3. An incoming transformation that caps dimensions. Phone photographs are
 *    routinely 4000px wide and several megabytes; storing them untouched would
 *    burn the free quota in a few dozen uploads for no visible benefit.
 *
 * A residual risk worth stating plainly: signed URLs here are unguessable but
 * do not expire. Time-limited tokens are a paid Cloudinary add-on. Delivery is
 * always through a transformation, which strips EXIF - so a photograph's GPS
 * coordinates are never served even though the stored original retains them.
 */
@Injectable()
export class CloudinaryProvider implements StorageProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);
  readonly isConfigured: boolean;

  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  /** Caps the stored original. Nothing in this product needs more than 2400px. */
  private static readonly INCOMING_TRANSFORM = 'c_limit,w_2400,h_2400,q_auto:good';

  constructor(private readonly config: ConfigService<Env, true>) {
    this.cloudName = this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true }) ?? '';
    this.apiKey = this.config.get('CLOUDINARY_API_KEY', { infer: true }) ?? '';
    this.apiSecret = this.config.get('CLOUDINARY_API_SECRET', { infer: true }) ?? '';

    this.isConfigured = Boolean(this.cloudName && this.apiKey && this.apiSecret);

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
      this.logger.log('Cloudinary configured (authenticated delivery)');
    } else {
      // Not an error. Photographs are simply unavailable until configured, and
      // every other part of the product carries on working.
      this.logger.warn('Cloudinary is not configured; photo uploads are disabled');
    }
  }

  createSignedUpload(familyId: string): SignedUpload {
    const timestamp = Math.floor(Date.now() / 1000);
    // The family id is in the path, so a stray asset is always traceable to
    // the family that owns it.
    const publicId = `families/${familyId}/${randomUUID()}`;

    const signable: Record<string, string | number> = {
      timestamp,
      public_id: publicId,
      type: 'authenticated',
      transformation: CloudinaryProvider.INCOMING_TRANSFORM,
    };

    const signature = cloudinary.utils.api_sign_request(signable, this.apiSecret);

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      params: {
        api_key: this.apiKey,
        timestamp: String(timestamp),
        public_id: publicId,
        type: 'authenticated',
        transformation: CloudinaryProvider.INCOMING_TRANSFORM,
        signature,
      },
      storageId: publicId,
    };
  }

  async describe(storageId: string): Promise<StoredAsset | null> {
    try {
      const asset = await cloudinary.api.resource(storageId, {
        type: 'authenticated',
        image_metadata: true,
      });

      return {
        storageId: asset.public_id as string,
        width: (asset.width as number) ?? null,
        height: (asset.height as number) ?? null,
        bytes: (asset.bytes as number) ?? null,
        format: (asset.format as string) ?? null,
        capturedAt: parseCaptureDate(asset.image_metadata as Record<string, string> | undefined),
      };
    } catch (error) {
      this.logger.warn(`Could not describe asset ${storageId}: ${String(error)}`);
      return null;
    }
  }

  signedUrl(storageId: string, variant: 'full' | 'thumb'): string {
    // Delivery always goes through a transformation. That is what strips EXIF -
    // including the GPS coordinates that would otherwise reveal where a family
    // lives - from every byte we serve.
    const transformation =
      variant === 'thumb'
        ? [{ width: 320, height: 320, crop: 'fill', gravity: 'faces', quality: 'auto', fetch_format: 'auto' }]
        : [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }];

    return cloudinary.url(storageId, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      transformation,
    });
  }

  async remove(storageId: string): Promise<void> {
    await cloudinary.uploader.destroy(storageId, { type: 'authenticated', invalidate: true });
  }
}

/**
 * Pulls the capture date out of EXIF.
 *
 * Worth the effort: a photograph's date is genuinely useful genealogical
 * evidence, and it is the one piece of EXIF we keep. GPS is deliberately not
 * read and never stored - it would tell anyone with access where the family
 * lives, which is not information a photograph should be carrying into a
 * shared archive.
 */
function parseCaptureDate(metadata: Record<string, string> | undefined): Date | null {
  const raw = metadata?.DateTimeOriginal ?? metadata?.DateTime;
  if (!raw) return null;

  // EXIF format: "2019:07:14 15:02:11"
  const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(raw);
  if (!match) return null;

  const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}