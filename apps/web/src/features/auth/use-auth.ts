import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@fh/shared';
import * as authApi from './api';
import { sessionQueryKey } from './api';

/**
 * The signed-in user, or null.
 *
 * `isPending` is the state that matters most: it means "we do not know yet".
 * Treating unknown as signed-out would flash the login page at a returning
 * user on every reload.
 */
export function useSession() {
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.fetchSession,
    // A 401 is a real answer, not a transient failure - retrying wastes a
    // round trip on every anonymous page load.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: query.data ?? null,
    isPending: query.isPending,
    isAuthenticated: Boolean(query.data),
    error: query.error,
  };
}

/** Writes the user into the cache so no refetch is needed after signing in. */
function useSessionWriter() {
  const queryClient = useQueryClient();
  return (user: SessionUser) => {
    queryClient.setQueryData(sessionQueryKey, user);
  };
}

export function useLogin() {
  const setSession = useSessionWriter();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: setSession,
  });
}

export function useRegister() {
  const setSession = useSessionWriter();
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: setSession,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // clear() rather than setQueryData(null): every cached query in the app
      // belongs to a family this user may no longer be able to see. Signing out
      // must leave nothing behind for the next person at this browser.
      queryClient.clear();
    },
  });
}

export function useVerifyMagicLink() {
  const setSession = useSessionWriter();
  return useMutation({
    mutationFn: authApi.verifyMagicLink,
    onSuccess: setSession,
  });
}

export function useRequestMagicLink() {
  return useMutation({ mutationFn: authApi.requestMagicLink });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: authApi.requestPasswordReset });
}

export function useConfirmPasswordReset() {
  return useMutation({ mutationFn: authApi.confirmPasswordReset });
}

export function useVerifyEmail() {
  return useMutation({ mutationFn: authApi.verifyEmail });
}