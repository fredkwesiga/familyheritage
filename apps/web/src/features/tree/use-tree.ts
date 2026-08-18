import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildFamilyGraph, type FamilyGraph, type MemberSummary } from '@fh/shared';
import * as treeApi from './api';
import { treeKeys } from './api';

export interface TreeData {
  graph: FamilyGraph;
  byId: Map<string, MemberSummary>;
  members: MemberSummary[];
  suggestedRootId: string | null;
}

/**
 * The whole family graph, fetched once and turned into the same structure the
 * relationship engine uses.
 *
 * Because the engine lives in @fh/shared, the client can compute generations,
 * siblings and even full relationships locally - no request when the user
 * re-centres the tree on someone else. That is what makes moving through the
 * tree feel immediate rather than networked.
 */
export function useTree(familyId: string) {
  const query = useQuery({
    queryKey: treeKeys.of(familyId),
    queryFn: () => treeApi.getTree(familyId),
  });

  const data = useMemo<TreeData | null>(() => {
    if (!query.data) return null;

    return {
      graph: buildFamilyGraph({
        parentChild: query.data.parentChild,
        partnerships: query.data.partnerships,
      }),
      byId: new Map(query.data.members.map((member) => [member.id, member])),
      members: query.data.members,
      suggestedRootId: query.data.suggestedRootId,
    };
  }, [query.data]);

  return { ...query, tree: data };
}