import type { QueryRequest, QueryResponse } from "@/interfaces";
import { api } from "./axiosClient";

export async function runQuery(request: QueryRequest): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>("/query", request);
  return data;
}
