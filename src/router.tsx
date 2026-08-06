import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,  // 5 min — prevents refetch on every nav
        gcTime: 15 * 60 * 1000,    // 15 min — keep unused data in memory longer
        refetchOnWindowFocus: false, // avoid surprise refetches when switching tabs
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 60_000, // preloaded data valid for 1 min
  });

  return router;
};
