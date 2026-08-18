import { familyTreeResponseSchema, type FamilyTree } from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

export const treeKeys = {
  of: (familyId: string) => ['families', familyId, 'tree'] as const,
};

export async function getTree(familyId: string): Promise<FamilyTree> {
  const { tree } = await apiRequest(`/families/${familyId}/tree`, familyTreeResponseSchema);
  return tree;
}