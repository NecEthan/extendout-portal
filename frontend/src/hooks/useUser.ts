import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser, logout, requestCode, verifyCode } from "@/lib/api/auth";

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: getUser,
  });
}

export function useRequestCode() {
  return useMutation({
    mutationFn: (email: string) => requestCode(email),
  });
}

export function useVerifyCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      verifyCode(email, code),
    onSuccess: (user) => {
      queryClient.setQueryData(["user"], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["user"] });
    },
  });
}
