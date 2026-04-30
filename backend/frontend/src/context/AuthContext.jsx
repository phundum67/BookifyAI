import { createContext, useContext, useEffect, useState } from "react";

import { authApi } from "../api";
import { setAuthToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await authApi.me();
      const currentUser = response.data.user || null;
      setUser(currentUser);
      if (!currentUser) {
        setAuthToken(null);
      }
      return currentUser;
    } catch (error) {
      setUser(null);
      setAuthToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const applyAuthResponse = async (response) => {
    if (response.data.token) {
      setAuthToken(response.data.token);
    }

    const currentUser = await refreshUser();
    if (currentUser) {
      return currentUser;
    }

    setUser(null);
    throw {
      status: 401,
      requiresLogin: true,
      message: "Your account was created, but we could not keep you signed in. Please log in again.",
      errors: ["Please log in to continue."],
    };
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
      await applyAuthResponse(response);
      return response;
    },
    login: async (payload) => {
      const response = await authApi.login(payload);
      await applyAuthResponse(response);
      return response;
    },
    logout: async () => {
      await authApi.logout().catch(() => {});
      setAuthToken(null);
      setUser(null);
    },
    chooseRole: async (account_type) => {
      const response = await authApi.chooseRole(account_type);
      if (response.data.token) {
        setAuthToken(response.data.token);
      }
      setUser(response.data.user);
      return response;
    },
    updateProfile: async (payload) => {
      const response = await authApi.updateProfile(payload);
      if (response.data.token) {
        setAuthToken(response.data.token);
      }
      setUser(response.data.user);
      return response;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
