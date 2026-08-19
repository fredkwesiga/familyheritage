import { useCurrentFamily } from '@/features/families/family-context';
import { useMemberAvatars } from '@/features/photos/use-photos';
import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  displayName: string;
  livingStatus: 'LIVING' | 'DECEASED' | 'UNKNOWN';
  /** When given, the member's profile picture is looked up automatically. */
  memberId?: string;
  /** An explicit URL wins over the lookup - used by the photo picker. */
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: 'size-10 text-sm',
  md: 'size-14 text-base',
  lg: 'size-20 text-xl',
  xl: 'size-32 text-3xl',
} as const;

function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * A member's picture, or a designed fallback.
 *
 * The fallback matters more than the photograph. A large share of any real
 * family tree has no image at all - the further back you go, the more certain
 * that is - and if "no photo" renders as a grey silhouette icon, the whole tree
 * looks broken rather than simply old. So the fallback is a warm monogram that
 * belongs in the design, not an error state.
 *
 * The URL is resolved here rather than passed in. Every avatar shares one
 * cached lookup, so a list of forty relatives makes a single request, and no
 * component in between needs to know photographs exist at all.
 */
export function MemberAvatar({
  displayName,
  livingStatus,
  memberId,
  photoUrl,
  size = 'md',
  className,
}: MemberAvatarProps) {
  const { family } = useCurrentFamily();
  const { data: avatars } = useMemberAvatars(family.id);

  const resolvedUrl = photoUrl ?? (memberId ? avatars?.[memberId] : undefined);
  const deceased = livingStatus === 'DECEASED';

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        loading="lazy"
        className={cn(
          'rounded-full object-cover',
          SIZES[size],
          // Grayscale is applied in the browser. The stored photograph is never
          // modified, so this is reversible the moment the record is corrected.
          deceased && 'photo-memoriam',
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-serif tracking-tight',
        SIZES[size],
        deceased
          ? 'bg-muted text-muted-foreground/80 ring-1 ring-border'
          : 'bg-accent/12 text-accent ring-1 ring-accent/20',
        className,
      )}
    >
      {initialsOf(displayName)}
    </span>
  );
}