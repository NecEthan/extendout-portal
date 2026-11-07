"use client";

import { useProjects } from "@/hooks/useProjects";

/** A project's name from the API (falls back to the id until loaded). */
export function ProjectName({ id }: { id: string }) {
  const { data } = useProjects();
  return <>{data?.find((p) => p.id === id)?.name ?? id}</>;
}
