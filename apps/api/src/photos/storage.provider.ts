/**
 * The storage boundary.
 *
 * Everything the rest of the application knows about photo storage is in this
 * file. Cloudinary's free tier is 25 credits a month and the next step up is
 * $89 - a cliff, not a slope - so the day this needs to become Cloudflare R2 or
 * S3 will come, and when it does it should be one new class implementing this
 * interface and nothing else.
 */

export interface SignedUpload {
  uploadUrl: string;
  params: Record<string, string>;
  storageId: string;
}

export interface StoredAsset {
  storageId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  /** When the camera says the photograph was taken, if the file carried it. */
  capturedAt: Date | null;
}

export interface StorageProvider {
  readonly isConfigured: boolean;

  /** Parameters the browser needs to upload directly, signed by us. */
  createSignedUpload(familyId: string): SignedUpload;

  /**
   * Confirms an asset exists and reports what it actually is.
   *
   * Called after the browser says it uploaded something. The client is not
   * trusted for dimensions, size or format - it reports an id, and we ask the
   * provider what is really there.
   */
  describe(storageId: string): Promise<StoredAsset | null>;

  /** A delivery URL that only someone holding our secret can produce. */
  signedUrl(storageId: string, variant: 'full' | 'thumb'): string;

  remove(storageId: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');