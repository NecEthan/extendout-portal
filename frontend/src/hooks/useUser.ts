import { useQuery } from "@tanstack/react-query";
import { getUser } from "@/lib/api/auth";

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: getUser,
  });
}
