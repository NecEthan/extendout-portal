import { useMutation } from "@tanstack/react-query";
import type { QueryRequest } from "@/interfaces";
import { runQuery } from "@/lib/api/query";

export function useSearchQuery() {
  return useMutation({
    mutationFn: (request: QueryRequest) => runQuery(request),
  });
}
