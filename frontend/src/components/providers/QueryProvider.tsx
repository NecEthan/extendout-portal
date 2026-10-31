"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { applicationRoutes } from "@/utils/applicationRoutes";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => {
    const onError = (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        // Clear the UI routing hint cookie too — proxy.ts bounces /login back
        // to /documents whenever this cookie is present, which would otherwise
        // fight this redirect and strand the user on the expired session.
        document.cookie = "kg_ui_auth=; path=/; max-age=0";
        router.replace(applicationRoutes.login);
      }
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: {
          retry: (failureCount, error) => {
            if (error instanceof ApiError && error.status === 401) return false;
            return failureCount < 3;
          },
        },
      },
    });
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
