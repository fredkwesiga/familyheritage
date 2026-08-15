import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { roleHasPermission, type Family, type Permission } from '@fh/shared';

interface FamilyContextValue {
  family: Family;
  /**
   * Whether the current user's role permits an action.
   *
   * This is a courtesy, never a control. It decides what to render; the server's
   * PermissionGuard decides what is allowed. Anything gated only here is not
   * protected at all.
   */
  can: (permission: Permission) => boolean;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ family, children }: { family: Family; children: ReactNode }) {
  const value = useMemo<FamilyContextValue>(
    () => ({
      family,
      can: (permission) => roleHasPermission(family.yourRole, permission),
    }),
    [family],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

/** Throws outside a FamilyProvider - a component tree bug, not a runtime state. */
export function useCurrentFamily(): FamilyContextValue {
  const value = useContext(FamilyContext);
  if (!value) {
    throw new Error('useCurrentFamily must be used inside a FamilyProvider');
  }
  return value;
}