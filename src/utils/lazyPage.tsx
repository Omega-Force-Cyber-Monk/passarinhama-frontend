import { lazy, Suspense, type ComponentType } from 'react';
import LoadingIndicator from '../components/ui/LoadingIndicator';

// React.lazy caches rejected imports. Discard a failed import so route retry/navigation
// can try the loader again, while retaining successful module caching.
export function lazyPage(loader: () => Promise<{ default: ComponentType<any> }>) {
  const load = () => {
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Page loading timed out');
        error.name = 'PageLoadTimeout';
        reject(error);
      }, 30000);
    });
    return Promise.race([loader(), deadline]).finally(() => clearTimeout(timer)).catch((error) => {
      Page = lazy(load);
      throw error;
    });
  };
  let Page = lazy(load);
  // Each page owns its initial boundary. Changing pages immediately shows loading;
  // changing parameters within the same page preserves its forms and local state.
  return function LazyPage() { return <Suspense fallback={<LoadingIndicator />}><Page /></Suspense>; };
}
