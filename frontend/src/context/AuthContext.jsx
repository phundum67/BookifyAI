import { createContext, useContext, useEffect, useState } from "react";

import { authApi } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await authApi.me();
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const value = {
    user,
    loading,
    setUser,
    refreshUser,
    signup: async (payload) => {
      const response = await authApi.signup(payload);
      setUser(response.data.user);
      return response;
    },
    login: async (payload) => {
      const response = await authApi.login(payload);
      setUser(response.data.user);
      return response;
    },
    logout: async () => {
      await authApi.logout();
      setUser(null);
    },
    chooseRole: async (account_type) => {
      const response = await authApi.chooseRole(account_type);
      setUser(response.data.user);
      return response;
    },
    updateProfile: async (payload) => {
      const response = await authApi.updateProfile(payload);
      setUser(response.data.user);
      return response;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
