import type { QueryRequest, QueryResponse } from "@/interfaces";
import { httpClient } from "./client";

export async function runQuery(request: QueryRequest): Promise<QueryResponse> {
  return httpClient<QueryResponse>("/query", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
