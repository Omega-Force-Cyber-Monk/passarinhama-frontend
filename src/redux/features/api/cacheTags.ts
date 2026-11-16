import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

// Authorization/validation failures are definite non-writes. Network/timeout/5xx
// outcomes may have committed; reconcile their narrowly scoped dependencies.
export const mutationChanged = (error: FetchBaseQueryError | undefined) =>
  !error || !(typeof error.status === 'number' && [400, 401, 403, 404, 405, 409, 422].includes(error.status));

export const profileTags = (user?: { id: string; role_details?: { id: string } | null } | null) => [
  ...(user ? [{ type: 'User' as const, id: user.id }] : []),
  { type: 'RoleMembers' as const, id: user?.role_details?.id || 'UNKNOWN' },
];
export const projectionTags = [{ type: 'Search' as const, id: 'GLOBAL' }, { type: 'Dashboard' as const, id: 'ACTIVITY' }];
export const statsTag = { type: 'Dashboard' as const, id: 'STATS' };
