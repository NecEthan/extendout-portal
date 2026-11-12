import type { QueryRequest, QueryResponse } from "@/interfaces";
import { apiRoutes } from "./apiRoutes";
import { api } from "./axiosClient";

export async function runQuery(request: QueryRequest): Promise<QueryResponse> {
  const { data } = await api.post<QueryResponse>(apiRoutes.query, request);
  return data;
}
