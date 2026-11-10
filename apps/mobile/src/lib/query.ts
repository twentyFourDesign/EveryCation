import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: (count, e) => count < 2 && !(e instanceof ApiError && e.status >= 400 && e.status < 500) } },
});
