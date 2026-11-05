// Accept only local destinations supplied by our guards.
export function authDestination(from: unknown): string {
  const location = from as { pathname?: unknown; search?: unknown; hash?: unknown } | undefined;
  if (typeof location?.pathname !== 'string' || !location.pathname.startsWith('/') || location.pathname.startsWith('//') ||
    ['/login', '/signup', '/forgot-password', '/verify-otp'].includes(location.pathname)) return '/';
  return location.pathname + (typeof location.search === 'string' ? location.search : '') + (typeof location.hash === 'string' ? location.hash : '');
}
