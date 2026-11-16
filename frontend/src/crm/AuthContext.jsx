import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { crm, getToken, setToken } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [ready, setReady] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const r = await crm.get("/users");
      setUsers(r.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    crm
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        loadUsers();
      })
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, [loadUsers]);

  const login = async (email, password) => {
    const r = await crm.post("/auth/login", { email, password });
    setToken(r.data.token);
    setUser(r.data.user);
    loadUsers();
    return r.data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const userName = (id) => users.find((u) => u.id === id)?.name || "—";

  return (
    <AuthCtx.Provider value={{ user, users, ready, login, logout, loadUsers, userName }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  }
  if (!user) return <Navigate to="/crm/login" state={{ from: loc.pathname }} replace />;
  return children;
}
