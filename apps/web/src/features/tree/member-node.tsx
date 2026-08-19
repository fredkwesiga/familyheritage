import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { formatLifeDates, type MemberSummary } from '@fh/shared';
import { MemberAvatar } from '@/features/members/member-avatar';
import { cn } from '@/lib/utils';
import { NODE_HEIGHT, NODE_WIDTH } from './layout';

export interface MemberNodeData extends Record<string, unknown> {
  member: MemberSummary;
  isFocus: boolean;
}

/**
 * A person on the canvas.
 *
 * Memoised because React Flow re-renders nodes on every viewport change, and a
 * two-hundred-node tree repainting on each frame of a pan is exactly the kind
 * of thing that makes a canvas feel broken on a mid-range phone.
 */
export const MemberNode = memo(function MemberNode({ data }: NodeProps) {
  const { member, isFocus } = data as MemberNodeData;
  const lifeDates = formatLifeDates(member.birth, member.death, member.livingStatus);
  const deceased = member.livingStatus === 'DECEASED';

  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-left transition-colors',
        isFocus ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/40',
      )}
    >
      {/* Handles are invisible; they only tell React Flow where lines attach.
          Top and bottom carry descent, left and right carry partnerships. */}
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="partner-right" className="!opacity-0" />
      <Handle type="target" position={Position.Left} id="partner-left" className="!opacity-0" />

      <MemberAvatar
      memberId={member.id}
        displayName={member.displayName}
        livingStatus={member.livingStatus}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm leading-snug tracking-tight">
          {member.displayName}
        </p>
        {lifeDates && (
          <p className="truncate text-xs tabular-nums text-muted-foreground">{lifeDates}</p>
        )}
        {deceased && <span className="sr-only">Deceased</span>}
      </div>
    </div>
  );
});