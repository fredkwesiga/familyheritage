import { useCallback, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TreeData } from './use-tree';
import { layoutFamilyTree, NODE_HEIGHT, NODE_WIDTH } from './layout';
import { MemberNode, type MemberNodeData } from './member-node';

const NODE_TYPES = { member: MemberNode };

/** Two generations each way is legible. Four is a wall of cards. */
const DEFAULT_DEPTH = 2;
/** React Flow renders a DOM node per person; past this a phone starts to suffer. */
const MAX_NODES = 260;

export function CanvasView({
  tree,
  focusId,
  onFocus,
  depth = DEFAULT_DEPTH,
}: {
  tree: TreeData;
  focusId: string;
  onFocus: (memberId: string) => void;
  depth?: number;
}) {
  const { nodes, edges, hiddenCount } = useMemo(() => {
    const layout = layoutFamilyTree(tree.graph, tree.byId, focusId, {
      depth,
      maxNodes: MAX_NODES,
    });

    const flowNodes: Node<MemberNodeData>[] = layout.nodes.map((node) => ({
      id: node.member.id,
      type: 'member',
      position: { x: node.x, y: node.y },
      data: { member: node.member, isFocus: node.member.id === focusId },
      // Positions come from our own layout, so React Flow must not move them.
      draggable: false,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));

    const flowEdges: Edge[] = [];

    for (const [childId, parents] of tree.graph.parents) {
      if (!layout.visibleIds.has(childId)) continue;
      for (const parent of parents) {
        if (!layout.visibleIds.has(parent.id)) continue;
        flowEdges.push({
          id: `pc-${parent.id}-${childId}-${parent.type}`,
          source: parent.id,
          target: childId,
          type: 'smoothstep',
          // Adoption and step links are drawn dashed: the connection is real,
          // and saying how it came about is part of the family's history.
          style: {
            stroke: 'var(--color-border)',
            strokeWidth: 1.5,
            ...(parent.type === 'BIOLOGICAL' ? {} : { strokeDasharray: '4 4' }),
          },
        });
      }
    }

    const seenPartnerships = new Set<string>();
    for (const [memberId, partners] of tree.graph.partners) {
      if (!layout.visibleIds.has(memberId)) continue;
      for (const partnerId of partners) {
        if (!layout.visibleIds.has(partnerId)) continue;
        const key = [memberId, partnerId].sort().join('-');
        if (seenPartnerships.has(key)) continue;
        seenPartnerships.add(key);

        flowEdges.push({
          id: `partner-${key}`,
          source: memberId,
          sourceHandle: 'partner-right',
          target: partnerId,
          targetHandle: 'partner-left',
          type: 'straight',
          style: { stroke: 'var(--color-accent)', strokeWidth: 2 },
        });
      }
    }

    return { nodes: flowNodes, edges: flowEdges, hiddenCount: layout.hiddenCount };
  }, [tree, focusId, depth]);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => onFocus(node.id),
    [onFocus],
  );

  return (
    <div className="space-y-2">
      <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.5}
          nodesConnectable={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={28} size={1} color="var(--color-border)" />
          <Controls showInteractive={false} />
          {/* Only worth the screen space once the tree is bigger than one view. */}
          {nodes.length > 20 && <MiniMap pannable zoomable className="!bg-card" />}
        </ReactFlow>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {nodes.length} {nodes.length === 1 ? 'person' : 'people'} within {depth}{' '}
        {depth === 1 ? 'generation' : 'generations'}. Click anyone to centre the tree on them.
        {hiddenCount > 0 && ` ${hiddenCount} more are outside this view.`}
      </p>
    </div>
  );
}