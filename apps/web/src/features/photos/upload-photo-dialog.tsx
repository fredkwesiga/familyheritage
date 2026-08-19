import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import {
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  type MemberSummary,
} from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { createUploadTarget, uploadToStorage } from './api';
import { useConfirmPhoto } from './use-photos';

/**
 * Upload, in three steps the user never sees separately.
 *
 *   1. Ask our API for signed upload parameters
 *   2. Send the file straight to the storage provider
 *   3. Tell our API what was created
 *
 * The bytes never touch our server, which is what keeps a family photo album
 * from having to fit through a 512 MB instance.
 */
export function UploadPhotoDialog({
  familyId,
  open,
  onClose,
  taggedMembers,
  onUploaded,
}: {
  familyId: string;
  open: boolean;
  onClose: () => void;
  /** Pre-tagged, because uploads usually start from someone's profile. */
  taggedMembers: MemberSummary[];
  onUploaded?: (photoId: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmPhoto = useConfirmPhoto(familyId);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setFile(null);
      setPreviewUrl(null);
      setCaption('');
      setProgress(0);
      setError('');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Object URLs leak until revoked, and a family adding twenty photographs in
  // one sitting would hold twenty full-size images in memory.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const chooseFile = (chosen: File | undefined) => {
    setError('');
    if (!chosen) return;

    if (!ACCEPTED_PHOTO_TYPES.includes(chosen.type)) {
      setError('That file is not a photograph. JPEG, PNG, WebP and HEIC all work.');
      return;
    }
    if (chosen.size > MAX_PHOTO_BYTES) {
      setError('That photograph is larger than 8 MB. Try a smaller version.');
      return;
    }

    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setProgress(0);

    try {
      const target = await createUploadTarget(familyId);
      await uploadToStorage(target, file, setProgress);

      const photo = await confirmPhoto.mutateAsync({
        storageId: target.storageId,
        caption: caption.trim() || undefined,
        memberIds: taggedMembers.map((member) => member.id),
      });

      onUploaded?.(photo.id);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'The upload did not finish.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-foreground backdrop:bg-foreground/20 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-6 p-6">
        <header className="space-y-2">
          <h2 className="font-serif text-2xl tracking-tight">Add a photograph</h2>
          {taggedMembers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              It will be added to{' '}
              {taggedMembers.map((member) => member.displayName).join(', ')}.
            </p>
          )}
        </header>

        <FormMessage>{error}</FormMessage>

        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="max-h-72 w-full rounded-lg border border-border object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ImagePlus aria-hidden className="size-7" />
            <span className="text-sm">Choose a photograph</span>
            <span className="text-xs">JPEG, PNG, WebP or HEIC, up to 8 MB</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />

        {file && (
          <>
            <FormField
              label="Caption"
              htmlFor="photo-caption"
              hint="Who is in it, or where it was taken. Optional."
            >
              <Input
                id="photo-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="At the house in Nakawa, 1982"
              />
            </FormField>

            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              Choose a different photograph
            </Button>
          </>
        )}

        {/* Progress matters here. A photograph uploading over a slow connection
            with no feedback is indistinguishable from a frozen application. */}
        {busy && (
          <div className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {progress < 100 ? `Uploading… ${progress}%` : 'Finishing up…'}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-border/60 pt-5">
          <Button onClick={() => void submit()} disabled={!file || busy}>
            {busy && <Loader2 aria-hidden className="animate-spin" />}
            Add photograph
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}