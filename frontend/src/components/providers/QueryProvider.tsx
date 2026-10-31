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
        router.replace(applicationRoutes.login);
      }
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
    });
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
