import { useState } from 'react';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { formatApproximateDate, Permission, type Member, type Photo } from '@fh/shared';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { useCurrentFamily } from '@/features/families/family-context';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { UploadPhotoDialog } from './upload-photo-dialog';
import { useDeletePhoto, useMemberPhotos, useSetPrimaryPhoto } from './use-photos';

/**
 * The photographs one person appears in.
 *
 * A grid rather than a carousel: a family looking through old pictures wants to
 * see them all at once and pick one, not step through them one at a time.
 */
export function MemberPhotos({ member }: { member: Member }) {
  const { family, can } = useCurrentFamily();
  const { data: photos, isPending } = useMemberPhotos(family.id, member.id);
  const setPrimary = useSetPrimaryPhoto(family.id);
  const deletePhoto = useDeletePhoto(family.id);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState('');

  const canUpload = can(Permission.PHOTO_UPLOAD);
  const canDelete = can(Permission.PHOTO_DELETE);
  const deceased = member.livingStatus === 'DECEASED';

  const makePrimary = async (photoId: string) => {
    setError('');
    try {
      await setPrimary.mutateAsync({ memberId: member.id, photoId });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not set that picture.');
    }
  };

  const remove = async (photo: Photo) => {
    if (!window.confirm('Remove this photograph? It can be restored.')) return;
    setError('');
    try {
      await deletePhoto.mutateAsync(photo.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove it.');
    }
  };

  if (isPending) return null;

  const items = photos ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl tracking-tight">Photographs</h2>
        {canUpload && (
          <Button variant="ghost" size="sm" onClick={() => setUploadOpen(true)}>
            <ImagePlus aria-hidden />
            Add
          </Button>
        )}
      </div>

      <FormMessage>{error}</FormMessage>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-pretty">
          {canUpload
            ? `No photographs of ${member.displayName} yet. Even one changes how a profile reads.`
            : 'No photographs yet.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((photo) => {
            const isPrimary = member.primaryPhotoId === photo.id;
            const when = formatApproximateDate(photo.takenDate);

            return (
              <li key={photo.id} className="group space-y-1.5">
                <div className="relative overflow-hidden rounded-lg border border-border bg-secondary/40">
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.caption ?? ''}
                    loading="lazy"
                    className={cn(
                      'aspect-square w-full object-cover',
                      // The same treatment as the avatar, and for the same
                      // reason: the file on disk is untouched, and this reverses
                      // the instant a mistake is corrected.
                      deceased && 'photo-memoriam',
                    )}
                  />

                  {isPrimary && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-card/90 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground">
                      Profile picture
                    </span>
                  )}

                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    {canUpload && !isPrimary && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 bg-card/90"
                        aria-label="Use as profile picture"
                        onClick={() => void makePrimary(photo.id)}
                      >
                        <Star aria-hidden className="size-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 bg-card/90 text-destructive"
                        aria-label="Remove this photograph"
                        onClick={() => void remove(photo)}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {(photo.caption || when) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {[photo.caption, when].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {deceased && items.length > 0 && (
        <p className="text-xs text-muted-foreground text-pretty">
          Photographs of someone who has died are shown in black and white. The original files are
          kept exactly as they were.
        </p>
      )}

      <UploadPhotoDialog
        familyId={family.id}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        taggedMembers={[
          {
            id: member.id,
            displayName: member.displayName,
            givenName: member.givenName,
            familyName: member.familyName,
            maidenName: member.maidenName,
            gender: member.gender,
            livingStatus: member.livingStatus,
            birth: member.birth,
            death: member.death,
            primaryPhotoId: member.primaryPhotoId,
            isRedacted: member.isRedacted,
            isYou: member.isYou,
            deletedAt: member.deletedAt,
          },
        ]}
      />
    </section>
  );
}