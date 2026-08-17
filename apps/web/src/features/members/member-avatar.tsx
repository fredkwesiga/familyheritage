import { cn } from '@/lib/utils';

interface MemberAvatarProps {
  displayName: string;
  livingStatus: 'LIVING' | 'DECEASED' | 'UNKNOWN';
  /** Cloudinary asset arrives in Phase 9. Until then this is always a monogram. */
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
 * The fallback matters more than the photograph here. A large share of any real
 * family tree has no image at all - the further back you go, the more certain
 * that is - and if "no photo" renders as a grey silhouette icon, the whole tree
 * looks broken rather than simply old. So the fallback is a warm monogram that
 * belongs in the design, not an error state.
 *
 * Deceased members get a muted treatment and, from Phase 9, the grayscale
 * filter on their actual photograph. The photograph itself is never altered.
 */
export function MemberAvatar({
  displayName,
  livingStatus,
  photoUrl,
  size = 'md',
  className,
}: MemberAvatarProps) {
  const deceased = livingStatus === 'DECEASED';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={cn(
          'rounded-full object-cover',
          SIZES[size],
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