import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me").then((d) => d.user),
    staleTime: 5 * 60 * 1000,
  });

  const onAuth = (d) => {
    qc.setQueryData(["me"], d.user);
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  };
  const login = useMutation({ mutationFn: (body) => api.post("/auth/login", body), onSuccess: onAuth });
  const register = useMutation({ mutationFn: (body) => api.post("/auth/register", body), onSuccess: onAuth });
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(["me"], null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    },
  });

  const user = data ?? null;
  const value = { user, isAdmin: user?.role === "admin", loading: isLoading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
