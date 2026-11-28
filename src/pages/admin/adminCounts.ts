export type AdminCount = {
  value?: number;
  status: 'ready' | 'loading' | 'error' | 'stale' | 'unavailable';
};

type CountQuery = { data?: unknown; isError: boolean; isFetching: boolean };

// Missing/malformed metadata is not evidence of a zero count. Array length is
// used only for the existing, unpaginated role list, never paginated content.
export function readAdminCount(query: CountQuery, wholeArray = false, field: 'total' | 'events_this_year' = 'total'): AdminCount {
  const data = query.data;
  const value = wholeArray ? (Array.isArray(data) ? data.length : undefined)
    : data && typeof data === 'object' && field in data ? (data as Record<string, unknown>)[field] : undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return { value, status: query.isError ? 'stale' : 'ready' };
  }
  return { status: query.isError ? 'error' : query.isFetching || data === undefined ? 'loading' : 'unavailable' };
}
